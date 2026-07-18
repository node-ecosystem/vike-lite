import { type JSX, createSignal, createEffect, onCleanup, ErrorBoundary, startTransition, batch, createMemo } from 'solid-js'
import { createStore, reconcile } from 'solid-js/store'
import { Dynamic, isServer } from 'solid-js/web'
import type { PageContext } from 'vike-lite'
import { BASE_URL, matchRoute, stripBase } from 'vike-lite/__internal/shared'
import { createLinkClickHandler, createLinkPrefetchHandler, finalizeNavigation } from 'vike-lite/__internal/client'
import type { VikeState } from 'vike-lite/__internal/server'

import { PageContextProvider } from './PageContextProvider'

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

export function RouterApp(props: RouterProps): JSX.Element {
  const [pageContext, setPageContext] = createStore<PageContext>(props.initialContext)
  const [view, setView] = createSignal<ViewComponents>(props.initialView)

  const [currentUrl, setCurrentUrl] = createSignal(props.initialUrl)
  const [currentPathname, setCurrentPathname] = createSignal(props.initialContext.urlPathname)

  const [reloadTick, setReloadTick] = createSignal(0)
  let reloadResolvers: Array<() => void> = []

  const matchedRoute = createMemo(() => matchRoute(currentPathname(), props.routes))

  // Track if we need to scroll to the top after the next load
  let shouldScrollToTop = false

  let pendingContextOverride: Partial<PageContext> | null = null

  if (!isServer) {
    const handleProgrammaticReload = (e: Event) => {
      const customEvent = e as CustomEvent<{ resolve?: () => void }>
      if (customEvent.detail?.resolve) {
        reloadResolvers.push(customEvent.detail.resolve)
      }

      // Use startTransition to let Solid know that this is a non-blocking update
      startTransition(() => {
        setReloadTick(t => t + 1)
      })
    }

    createEffect(() => {
      const handleLinkClick = createLinkClickHandler((url) => {
        if (!url.hash) shouldScrollToTop = true
        startTransition(() => {
          setCurrentUrl(url.href)
          // Click on a link, we need to remove the base from the pathname
          setCurrentPathname(stripBase(url.pathname))
        })
      })

      const prefetchedModules = new Set<string>()

      function prefetchRoute(route: VikeState['routes'][number]) {
        const modules: Array<[string | undefined, (() => Promise<any>) | undefined]> = [
          [route.page, route.Page],
          [route.layout, route.Layout],
          [route.head, route.Head]
        ]

        for (const [key, loader] of modules) {
          if (!key || !loader || prefetchedModules.has(key)) continue
          prefetchedModules.add(key)
          void loader().catch(() => { prefetchedModules.delete(key) })
        }
      }

      const handleLinkPrefetch = createLinkPrefetchHandler((url) => {
        const pathname = stripBase(url.pathname)
        const matched = matchRoute(pathname, props.routes)
        if (matched) prefetchRoute(matched.route)
      })

      const handlePopState = () => {
        startTransition(() => {
          setCurrentUrl(globalThis.location.href)
          // Remove the base from the pathname when using the back button
          setCurrentPathname(stripBase(globalThis.location.pathname))
        })
      }

      const handleProgrammaticNavigate = (e: Event) => {
        const customEvent = e as CustomEvent<{
          keepScrollPosition?: boolean
          pageContext?: Partial<PageContext>
        }>
        const detail = customEvent.detail || {}

        // Set the scroll flag only if the user hasn't requested to keep it
        if (!detail.keepScrollPosition) shouldScrollToTop = true

        if (detail.pageContext) pendingContextOverride = detail.pageContext

        startTransition(() => {
          setCurrentUrl(globalThis.location.href)
          setCurrentPathname(stripBase(globalThis.location.pathname))
        })
      }

      document.addEventListener('click', handleLinkClick)
      document.addEventListener('pointerenter', handleLinkPrefetch, { capture: true })
      document.addEventListener('focusin', handleLinkPrefetch)
      globalThis.addEventListener('popstate', handlePopState)
      globalThis.addEventListener('vike-navigate', handleProgrammaticNavigate)
      globalThis.addEventListener('vike-reload', handleProgrammaticReload)

      onCleanup(() => {
        document.removeEventListener('click', handleLinkClick)
        document.removeEventListener('pointerenter', handleLinkPrefetch, { capture: true })
        document.removeEventListener('focusin', handleLinkPrefetch)
        globalThis.removeEventListener('popstate', handlePopState)
        globalThis.removeEventListener('vike-navigate', handleProgrammaticNavigate)
        globalThis.removeEventListener('vike-reload', handleProgrammaticReload)
      })
    })

    createEffect(() => {
      const pathname = currentPathname()
      // Makes the effect reactive to reload
      const isReload = reloadTick() > 0

      if (!isReload && globalThis.__PAGE_CONTEXT__ && globalThis.__PAGE_CONTEXT__.urlPathname === pathname) {
        // @ts-expect-error - Internal framework hydration hack: we consume the pathname
        // to prevent false positives on subsequent navigations
        globalThis.__PAGE_CONTEXT__.urlPathname = undefined
        return
      }

      const controller = new AbortController()
      const urlFull = currentUrl()
      const matched = matchedRoute()

      const loadRoute = async (signal: AbortSignal) => {
        const contextOverride = pendingContextOverride
        pendingContextOverride = null

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
            setPageContext(reconcile({
              ...pageContext,
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
          finalizeNavigation(shouldScrollToTop)
        }

        //  Native 404 fallback if the route doesn't exist on the Client
        if (!matched) return renderErrorPage(true)

        const { route, routeParams } = matched
        try {
          const urlObj = new URL(urlFull)

          // Get the URL for the fetch by adding the base
          const jsonTarget = pathname === '/' ? '/index' : pathname
          // e.g. base "/my-app/" and path "/about" → fetch "/my-app/about.pageContext.json"
          const jsonUrl = `${BASE_URL}${jsonTarget}.pageContext.json${urlObj.search}`

          // Fetch JSON data
          let ctx: any = null
          if (route.data || route.title) {
            const res = await fetch(jsonUrl, { signal, cache: isReload ? 'no-cache' : 'default' })
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
            globalThis.history.pushState({ triggeredBy: 'vike-lite' }, '', ctx._redirect)
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
            setPageContext(reconcile({
              routeParams,
              urlOriginal: urlObj.href,
              urlPathname: pathname,
              search: urlObj.search,
              ...(ctx?.data && { data: ctx.data }),
              ...(ctx?.title && { title: ctx.title }),
              ...contextOverride
            }))
            setView({
              Page: PageMod.Page ?? PageMod.default,
              Layout: LayoutMod?.Layout ?? LayoutMod?.default ?? null,
              Head: HeadMod?.Head ?? HeadMod?.default ?? null
            })
          })
          if (ctx?.title) document.title = ctx.title

          // Accessibility: after a client-side navigation,
          // the keyboard focus remains on the clicked <a> element,
          // and screen readers are not notified of the page change.
          requestAnimationFrame(() => {
            if (globalThis.location.hash) return
            document.querySelector<HTMLDivElement>('#root')!.focus({ preventScroll: true })
          })

          finalizeNavigation(shouldScrollToTop)
        } catch (error) {
          // Handle Network or Import Errors
          if ((error as Error).name === 'AbortError') return

          const message = (error as Error).message || ''
          // The DEV server has been restarted or a new build has been deployed in PROD:
          // the browser's module graph no longer matches the server.
          // No SPA navigation can resolve this state — a full reload is required.
          // Anti-loop guard: if the reload doesn't resolve (e.g. the page really doesn't exist),
          // we don't reload indefinitely.
          const isStaleModuleGraph = /dynamically imported module|importing a module script failed/i.test(message)
          if (isStaleModuleGraph) {
            const GUARD_KEY = 'vike-lite:reload-guard'
            const last = Number(sessionStorage.getItem(GUARD_KEY) ?? 0)
            if (Date.now() - last > 10_000) {
              sessionStorage.setItem(GUARD_KEY, String(Date.now()))
              console.warn('App update detected, forcing reload…')
              // Ignore the client router and force a standard browser navigation
              globalThis.location.assign(urlFull)
              return
            }
          }

          console.error('Router Error:', error)
          renderErrorPage(false, message)
        } finally {
          if (!signal.aborted) {
            for (const resolve of reloadResolvers) resolve()
            reloadResolvers = []
          }
        }
      }

      loadRoute(controller.signal)
      onCleanup(() => controller.abort())
    })
  }

  return (
    <ErrorBoundary fallback={(err: Error) => (
      <div style={{ 'font-family': 'sans-serif', padding: '2rem', 'text-align': 'center' }}>
        {import.meta.env.DEV ? (
          <div style={{ 'text-align': 'left', background: '#fee2e2', padding: '1rem', 'border-radius': '4px' }}>
            <h2 style={{ color: '#991b1b', 'margin-top': 0 }}><strong>{err.name}:</strong> {err.message}</h2>

            <pre style={{ background: '#222', color: '#fff', padding: '1rem', 'overflow-x': 'auto', 'margin-top': '1rem' }}>
              {err.stack}
            </pre>
          </div>
        ) : (
          <>
            <h1>500 | Internal Error</h1>

            <p>An unexpected error occurred. Please try again later.</p>
          </>
        )}
      </div>
    )}>
      <PageContextProvider pageContext={pageContext} setPageContext={setPageContext}>
        {(() => {
          const { Page, Layout } = view()
          return <>{Layout ? <Dynamic component={Layout}><Dynamic component={Page} /></Dynamic> : <Dynamic component={Page} />}</>
        })()}
      </PageContextProvider>
    </ErrorBoundary>
  )
}
