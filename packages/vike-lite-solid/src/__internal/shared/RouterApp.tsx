import { type JSX, createSignal, createEffect, onCleanup, ErrorBoundary, startTransition, batch, createMemo } from 'solid-js'
import { createStore, reconcile } from 'solid-js/store'
import { isServer } from 'solid-js/web'
import type { PageContext } from 'vike-lite'
import { matchRoute } from 'vike-lite/__internal/shared'

import PageContextProvider from './PageContextProvider'
import stripBase, { BASE_URL } from './stripBase'

export interface ViewComponents {
  Page: any | null
  Layout: any | null
  Head: any | null
}

export interface RouterProps {
  routes: any[]
  errorRoute: any | null
  initialView: ViewComponents
  initialContext: PageContext
  initialUrl: string
}

export default function RouterApp(props: RouterProps): JSX.Element {
  const [pageContextStore, setPageContextStore] = createStore<PageContext>(props.initialContext)
  const [view, setView] = createSignal<ViewComponents>(props.initialView)

  const [currentUrl, setCurrentUrl] = createSignal(props.initialUrl)
  const [currentPathname, setCurrentPathname] = createSignal(props.initialContext.urlPathname)

  const matchedRoute = createMemo(() => matchRoute(currentPathname(), props.routes))

  if (!isServer) {
    createEffect(() => {
      const handleLinkClick = (e: MouseEvent) => {
        const target = (e.target as HTMLElement).closest('a')
        if (!target?.href || target.target === '_blank' || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
        const url = new URL(target.href)
        if (url.origin !== globalThis.location.origin) return
        e.preventDefault()
        globalThis.history.pushState(null, '', url.href)
        startTransition(() => {
          setCurrentUrl(url.href)
          // Click on a link, we need to remove the base from the pathname
          setCurrentPathname(stripBase(url.pathname))
        })
      }
      const handlePopState = () => {
        startTransition(() => {
          setCurrentUrl(globalThis.location.href)
          // Remove the base from the pathname when using the back button
          setCurrentPathname(stripBase(globalThis.location.pathname))
        })
      }
      document.addEventListener('click', handleLinkClick)
      globalThis.addEventListener('popstate', handlePopState)
      onCleanup(() => {
        document.removeEventListener('click', handleLinkClick)
        globalThis.removeEventListener('popstate', handlePopState)
      })
    })

    createEffect(() => {
      const pathname = currentPathname()

      if (globalThis.__PAGE_CONTEXT__ && globalThis.__PAGE_CONTEXT__.urlPathname === pathname) {
        globalThis.__PAGE_CONTEXT__.urlPathname = undefined
        return
      }

      const controller = new AbortController()
      const urlFull = currentUrl()
      const matched = matchedRoute()

      const loadRoute = async (signal: AbortSignal) => {
        if (!matched) return

        const { route, routeParams } = matched
        try {
          const urlObj = new URL(urlFull)

          // Get the URL for the fetch by adding the base
          const jsonTarget = pathname === '/' ? '/index' : pathname
          const baseNoSlash = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL
          const jsonUrl = `${baseNoSlash}${jsonTarget}.pageContext.json${urlObj.search}`
          // e.g. base "/my-app/" and path "/about" → fetch "/my-app/about.pageContext.json"

          const [PageMod, LayoutMod, HeadMod, ctx] = await Promise.all([
            route.Page(),
            route.Layout?.() ?? null,
            route.Head?.() ?? null,
            // eslint-disable-next-line unicorn/prefer-await
            route.hasData || route.hasTitle ? fetch(jsonUrl, { signal }).then(r => r.json() as Promise<PageContext>) : null
          ])

          if (signal.aborted) return

          batch(() => {
            setPageContextStore(reconcile({
              routeParams,
              urlOriginal: urlObj.href,
              urlPathname: pathname,
              ...(ctx?.data && { data: ctx.data }),
              ...(ctx?.title && { title: ctx.title })
            }))
            setView({
              Page: PageMod.Page ?? PageMod.default,
              Layout: LayoutMod?.Layout ?? LayoutMod?.default ?? null,
              Head: HeadMod?.Head ?? HeadMod?.default ?? null
            })
          })
          if (ctx?.title) document.title = ctx.title

        } catch { }
      }

      loadRoute(controller.signal)
      onCleanup(() => controller.abort())
    })
  }

  return (
    <ErrorBoundary fallback={(err: Error) => <div>Error: {err.message}</div>}>
      <PageContextProvider pageContext={pageContextStore} setPageContext={setPageContextStore}>
        {(() => {
          const { Page, Layout } = view()
          return <>{Layout ? <Layout><Page /></Layout> : <Page />}</>
        })()}
      </PageContextProvider>
    </ErrorBoundary>
  )
}
