import { type JSX, createSignal, createEffect, onCleanup, ErrorBoundary, startTransition, batch, createMemo } from 'solid-js'
import { createStore, reconcile } from 'solid-js/store'
import { Dynamic, hydrate, render, isServer } from 'solid-js/web'
import type { PageContext } from 'vike-lite'
import { matchRoute, stripBase } from 'vike-lite/__internal/shared'
import { buildPageContextJsonUrl, buildInitialClientContext, consumeMatchingInitialContext, createLinkClickHandler, createLinkPrefetchHandler, createRoutePrefetcher, fetchPageContextJson, finalizeNavigation, tryRecoverFromStaleModuleGraph, loadViewModules } from 'vike-lite/__internal/client'
import type { VikeState } from 'vike-lite/__internal/server'

import { PageContextProvider } from '../shared/PageContextProvider'
import { RootErrorBoundary } from '../shared/RootErrorBoundary'

interface ViewComponents {
  Page: any | null
  Layout: any | null
  Head: any | null
}

interface RouterProps {
  routes: VikeState['routes']
  errorRoute: VikeState['errorRoute']
  initialView: ViewComponents
  initialContext: PageContext
  initialUrl: string
}

function RouterApp(props: RouterProps): JSX.Element {
  const [pageContext, setPageContext] = createStore<PageContext>(props.initialContext)
  const [view, setView] = createSignal<ViewComponents>(props.initialView)

  const [currentUrl, setCurrentUrl] = createSignal(props.initialUrl)
  const [currentPathname, setCurrentPathname] = createSignal(props.initialContext.urlPathname)

  const [reloadTick, setReloadTick] = createSignal(0)
  let reloadResolvers: Array<() => void> = []

  const matchedRoute = createMemo(() => matchRoute(currentPathname(), props.routes))

  // Plain mutable object (NOT a Vue ref / Solid signal — intentionally non-reactive)
  // Track if we need to scroll to the top after the next load
  // value is passed by reference to the finalizeNavigation function
  const shouldScrollToTop = { current: false }

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
        if (!url.hash) shouldScrollToTop.current = true
        batch(() => {
          setCurrentUrl(url.href)
          // Click on a link, we need to remove the base from the pathname
          setCurrentPathname(stripBase(url.pathname))
        })
      })

      const prefetchRoute = createRoutePrefetcher()

      const handleLinkPrefetch = createLinkPrefetchHandler((url) => {
        const pathname = stripBase(url.pathname)
        const matched = matchRoute(pathname, props.routes)
        if (matched) prefetchRoute(matched.route)
      })

      const handlePopState = () => {
        batch(() => {
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
        if (!detail.keepScrollPosition) shouldScrollToTop.current = true

        if (detail.pageContext) pendingContextOverride = detail.pageContext

        batch(() => {
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

      if (!isReload && consumeMatchingInitialContext(pathname)) {
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
          const errorView = await loadViewModules(props.errorRoute)
          if (signal.aborted) return

          batch(() => {
            setPageContext(reconcile({
              ...pageContext,
              urlOriginal: urlFull, urlPathname: pathname, routeParams: {},
              is404, is500: !is404, errorMessage: message
            } as PageContext))
            setView(errorView)
          })
          document.title = is404 ? 'Not Found' : 'Server Error'
          finalizeNavigation(shouldScrollToTop)
        }

        //  Native 404 fallback if the route doesn't exist on the Client
        if (!matched) return renderErrorPage(true)

        const { route, routeParams } = matched
        try {
          const urlObj = new URL(urlFull)

          // Get the URL for the fetch
          const jsonUrl = buildPageContextJsonUrl(pathname, urlObj.search)

          // Fetch JSON data
          const ctx: any = (route.data || route.title)
            ? await fetchPageContextJson(jsonUrl, { signal, cache: isReload ? 'no-cache' : 'default' })
            : null

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
            shouldScrollToTop.current = true
            batch(() => {
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
          const newView = await loadViewModules(route)

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
            setView(newView)
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
          const isStaleModuleGraph = tryRecoverFromStaleModuleGraph(message, urlFull)
          if (isStaleModuleGraph) return

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
    <RootErrorBoundary>
      <PageContextProvider pageContext={pageContext} setPageContext={setPageContext}>
        {(() => {
          const { Page, Layout } = view()
          return <>{Layout ? <Dynamic component={Layout}><Dynamic component={Page} /></Dynamic> : <Dynamic component={Page} />}</>
        })()}
      </PageContextProvider>
    </RootErrorBoundary>
  )
}

export async function onRenderClient(clientOptions: Omit<RouterProps, 'initialView' | 'initialContext' | 'initialUrl'> & { hydration: boolean }) {
  const container = document.querySelector<HTMLDivElement>('#root')!

  let initialView: ViewComponents = { Page: null, Layout: null, Head: null }

  const isHydration = !!(clientOptions.hydration && globalThis.__PAGE_CONTEXT__ && globalThis._$HY)

  // Clone or initialize the context safely, stamping the client-only flags every
  // PageContextClient requires (isClientSide, isHydration) — in linea con gli altri adapter.
  const initialContext = buildInitialClientContext(globalThis.__PAGE_CONTEXT__, isHydration)

  // Clean up the fallback and assign to the context
  const pathname = initialContext.urlPathname ?? stripBase(globalThis.location.pathname)
  const urlOriginal = initialContext.urlOriginal ?? globalThis.location.href

  initialContext.urlPathname = pathname
  initialContext.urlOriginal = urlOriginal

  // If the server reported a 404 or 500 error, load the error modules!
  if (initialContext.is404 || initialContext.is500 || initialContext.errorMessage) {
    if (clientOptions.errorRoute) {
      initialView = await loadViewModules(clientOptions.errorRoute)
    }
  } else {
    // Otherwise, perform the normal route match
    const matched = matchRoute(pathname, clientOptions.routes)
    if (matched) {
      initialView = await loadViewModules(matched.route)
    } else if (clientOptions.errorRoute) {
      // Fallback: The URL does not exist in the client routing
      initialView = await loadViewModules(clientOptions.errorRoute)
      initialContext.is404 = true
    }
  }

  const App = () => (
    <RouterApp
      {...clientOptions}
      initialView={initialView}
      initialContext={initialContext}
      initialUrl={urlOriginal}
    />
  )

  if (isHydration) {
    hydrate(App, container)
  } else {
    container.replaceChildren()
    render(App, container)
  }
}
