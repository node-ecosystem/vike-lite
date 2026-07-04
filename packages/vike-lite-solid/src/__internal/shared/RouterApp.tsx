import { type JSX, createSignal, createEffect, onCleanup, ErrorBoundary, startTransition, batch, createMemo } from 'solid-js'
import { createStore, reconcile } from 'solid-js/store'
import { isServer } from 'solid-js/web'
import type { PageContext } from 'vike-lite'
import { matchRoute } from 'vike-lite/__internal/shared'
import type { VikeState } from 'vike-lite/__internal/server'

import PageContextProvider from './PageContextProvider'
import stripBase, { BASE_URL } from './stripBase'

export interface ViewComponents {
  Page: any | null
  Layout: any | null
  Head: any | null
}

export interface RouterProps {
  routes: VikeState['routes']
  errorRoute: VikeState['errorRoute']
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

  // Track if we need to scroll to the top after the next load
  let shouldScrollToTop = false

  if (!isServer) {
    createEffect(() => {
      const handleLinkClick = (e: MouseEvent) => {
        const target = (e.target as HTMLElement).closest('a')
        if (!target?.href || target.target === '_blank' || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return

        const url = new URL(target.href)
        if (url.origin !== globalThis.location.origin) return

        // If it's a link to the SAME exact page (only the hash changes)
        // Let the browser handle it natively! (It will jump to the correct ID by itself)
        const isSamePage = url.pathname === globalThis.location.pathname && url.search === globalThis.location.search
        if (isSamePage) return

        e.preventDefault()
        globalThis.history.pushState(null, '', url.href)

        if (!url.hash) shouldScrollToTop = true

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

      const handleProgrammaticNavigate = (e: Event) => {
        const customEvent = e as CustomEvent<{ keepScrollPosition?: boolean }>
        const detail = customEvent.detail || {}

        // Set the scroll flag only if the user hasn't requested to keep it
        if (!detail.keepScrollPosition) {
          shouldScrollToTop = true
        }

        startTransition(() => {
          setCurrentUrl(globalThis.location.href)
          setCurrentPathname(stripBase(globalThis.location.pathname))
        })
      }

      document.addEventListener('click', handleLinkClick)
      globalThis.addEventListener('popstate', handlePopState)
      globalThis.addEventListener('vike-navigate', handleProgrammaticNavigate)

      onCleanup(() => {
        document.removeEventListener('click', handleLinkClick)
        globalThis.removeEventListener('popstate', handlePopState)
        globalThis.removeEventListener('vike-navigate', handleProgrammaticNavigate)
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
        // Scroll only when the content is ready
        function finalizeNavigation() {
          if (shouldScrollToTop) {
            globalThis.scrollTo(0, 0)
            shouldScrollToTop = false
          } else if (globalThis.location.hash) {
            // If there's a hash in the URL, wait for the new DOM to be physically on screen
            // and try to scroll to the element
            requestAnimationFrame(() => {
              const el = document.querySelector<HTMLElement>(globalThis.location.hash)
              if (el) el.scrollIntoView()
            })
          }
        }
        const renderErrorPage = async (is404: boolean, message?: string) => {
          if (!props.errorRoute) return
          // Fetch the error page components instead of the normal ones
          const [ErrorPageMod, ErrorLayoutMod, ErrorHeadMod] = await Promise.all([
            props.errorRoute.Page(),
            props.errorRoute.Layout?.() ?? null,
            props.errorRoute.Head?.() ?? null
          ])
          if (signal.aborted) return
          batch(() => {
            setPageContextStore(reconcile({
              urlOriginal: urlFull, urlPathname: pathname, routeParams: {},
              is404, is500: !is404, errorMessage: message
            } as PageContext))
            setView({
              Page: ErrorPageMod.Page ?? ErrorPageMod.default,
              Layout: ErrorLayoutMod?.Layout ?? ErrorLayoutMod?.default ?? null,
              Head: ErrorHeadMod?.Head ?? ErrorHeadMod?.default ?? null
            })
          })
          document.title = is404 ? 'Not Found' : 'Server Error'
          finalizeNavigation()
        }

        //  Native 404 fallback if the route doesn't exist on the Client
        if (!matched) return renderErrorPage(true)

        const { route, routeParams } = matched
        try {
          const urlObj = new URL(urlFull)

          // Get the URL for the fetch by adding the base
          const jsonTarget = pathname === '/' ? '/index' : pathname
          const baseNoSlash = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL
          // e.g. base "/my-app/" and path "/about" → fetch "/my-app/about.pageContext.json"
          const jsonUrl = `${baseNoSlash}${jsonTarget}.pageContext.json${urlObj.search}`

          // Fetch JSON data
          let ctx: any = null
          if (route.data || route.title) {
            const res = await fetch(jsonUrl, { signal })
            const contentType = res.headers.get('content-type') ?? ''
            if (!contentType.includes('application/json')) {
              // A proxy/CDN intercepted the response (e.g. custom 404 page from hosting)
              // instead of letting the JSON body generated by the server pass through
              throw new Error(`Expected JSON but got "${contentType}" for ${jsonUrl}. Check your proxy/CDN configuration.`)
            }
            ctx = await res.json()
          }

          if (signal.aborted) return

          // Handle Redirect: check if there is a redirect (e.g. throw redirect('/login'))
          if (ctx?._redirect) {
            const urlObjRedirect = new URL(ctx._redirect, globalThis.location.origin)
            // If the redirect is to another domain, exit the app
            if (urlObjRedirect.origin !== globalThis.location.origin) {
              globalThis.location.assign(ctx._redirect)
              return
            }

            // Update the URL manually and perform the Solid transition
            globalThis.history.pushState(null, '', ctx._redirect)
            shouldScrollToTop = true
            startTransition(() => {
              setCurrentUrl(urlObjRedirect.href)
              setCurrentPathname(stripBase(urlObjRedirect.pathname))
            })
            return // Stops loading of this route
          }

          // Check if there is a Server Errors (e.g. throw render(404))
          if (ctx && (ctx.is404 || ctx.is500 || ctx.isError)) {
            return renderErrorPage(ctx.is404, ctx.reason || 'Server Error')
          }

          // Load Normal Page: if everything is fine, fetch the normal components
          const [PageMod, LayoutMod, HeadMod] = await Promise.all([
            route.Page(),
            route.Layout?.() ?? null,
            route.Head?.() ?? null
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
          finalizeNavigation()
        } catch (error) {
          // Handle Network or Import Errors
          if ((error as Error).name === 'AbortError') return
          console.error('Router Error:', error)
          renderErrorPage(false, (error as Error).message)
        }
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
