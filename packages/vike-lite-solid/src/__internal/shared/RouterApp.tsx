import { createSignal, createEffect, onCleanup, ErrorBoundary, startTransition, batch, createMemo, type JSX, type ParentComponent, type ValidComponent } from 'solid-js'
import { createStore, reconcile } from 'solid-js/store'
import { Dynamic, isServer } from 'solid-js/web'
import type { PageContext } from 'vike-lite'
import { buildPageContextJsonUrl, buildNavigationPageContext, consumeMatchingInitialContext, createLinkClickHandler, createLinkPrefetchHandler, createRoutePrefetcher, fetchPageContextJson, finalizeNavigation, tryRecoverFromStaleModuleGraph, loadViewModules, type PageContextJson } from 'vike-lite/__internal/client'
import type { VikeState } from 'vike-lite/__internal/server'
import { matchRoute, stripBase } from 'vike-lite/__internal/shared'

import { PageContextProvider } from './PageContextProvider'

export interface ViewComponents {
  Page: ValidComponent | null
  Layout: ValidComponent | null
  Head: ValidComponent | null
}

export interface RouterProps {
  routes: VikeState['routes']
  errorRoute: VikeState['errorRoute']
  initialView: ViewComponents
  initialContext: PageContext
  initialUrl: string
}

const RootErrorBoundary: ParentComponent<{ onReset: (reset: () => void) => void }> = (props) => {
  return (
    <ErrorBoundary fallback={(err: Error, reset) => {
      props.onReset(reset)
      return (
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
      )
    }}>
      {props.children}
    </ErrorBoundary>
  )
}

export function RouterApp(props: RouterProps): JSX.Element {
  const [pageContext, setPageContext] = createStore<PageContext>(props.initialContext)
  const [view, setView] = createSignal<ViewComponents>(props.initialView)

  const [currentUrl, setCurrentUrl] = createSignal(props.initialUrl)
  const [currentPathname, setCurrentPathname] = createSignal(props.initialContext.urlPathname)

  const [reloadTick, setReloadTick] = createSignal(0)
  let reloadResolvers: Array<() => void> = []

  const matchedRoute = createMemo(() => matchRoute(currentPathname(), props.routes))

  const shouldScrollToTop = { current: false }
  let pendingContextOverride: Partial<PageContext> | null = null

  let resetErrorBoundary: (() => void) | undefined

  if (!isServer) {
    const handleProgrammaticReload = (e: Event) => {
      const customEvent = e as CustomEvent<{ resolve?: () => void }>
      if (customEvent.detail?.resolve) reloadResolvers.push(customEvent.detail.resolve)
      startTransition(() => setReloadTick(t => t + 1))
    }

    createEffect(() => {
      const handleLinkClick = createLinkClickHandler((url) => {
        if (!url.hash) shouldScrollToTop.current = true
        batch(() => {
          setCurrentUrl(url.href)
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
          setCurrentPathname(stripBase(globalThis.location.pathname))
        })
      }

      const handleProgrammaticNavigate = (e: Event) => {
        const customEvent = e as CustomEvent<{ keepScrollPosition?: boolean; pageContext?: Partial<PageContext> }>
        const detail = customEvent.detail || {}

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
      const isReload = reloadTick() > 0

      if (!isReload && consumeMatchingInitialContext(pathname)) return

      resetErrorBoundary?.()
      const controller = new AbortController()
      const urlFull = currentUrl()
      const matched = matchedRoute()

      const loadRoute = async (signal: AbortSignal) => {
        const contextOverride = pendingContextOverride
        pendingContextOverride = null

        const renderErrorPage = async (is404: boolean, message?: string) => {
          if (!props.errorRoute) return
          const errorView = await loadViewModules<ValidComponent>(props.errorRoute)
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

        if (!matched) return renderErrorPage(true)

        const { route, routeParams } = matched
        try {
          const urlObj = new URL(urlFull)
          const jsonUrl = buildPageContextJsonUrl(pathname, urlObj.search)

          const ctx: PageContextJson | null = (route.data || route.title)
            ? await fetchPageContextJson(jsonUrl, { signal, cache: isReload ? 'no-cache' : 'default' })
            : null

          if (signal.aborted) return

          if (ctx?._redirect) {
            const urlObjRedirect = new URL(ctx._redirect, globalThis.location.origin)
            if (urlObjRedirect.origin !== globalThis.location.origin) {
              globalThis.location.assign(ctx._redirect)
              return
            }

            globalThis.history.pushState({ triggeredBy: 'vike-lite' }, '', ctx._redirect)
            shouldScrollToTop.current = true
            batch(() => {
              setCurrentUrl(urlObjRedirect.href)
              setCurrentPathname(stripBase(urlObjRedirect.pathname))
            })
            return
          }

          if (ctx && (ctx.is404 || ctx.is500 || ctx.isError)) {
            return renderErrorPage(ctx.is404 ?? false, ctx.reason || 'Server Error')
          }

          const newView = await loadViewModules<ValidComponent>(route)

          if (signal.aborted) return

          batch(() => {
            setPageContext(reconcile(buildNavigationPageContext({
              routeParams,
              urlOriginal: urlObj.href,
              urlPathname: pathname,
              search: urlObj.search,
              ...(ctx?.data !== undefined ? { data: ctx.data } : {}),
              ...(ctx?.title ? { title: ctx.title } : {}),
              ...contextOverride
            }) as PageContext))
            setView(newView)
          })
          if (ctx?.title) document.title = ctx.title

          requestAnimationFrame(() => {
            if (globalThis.location.hash) return
            document.querySelector<HTMLDivElement>('#root')!.focus({ preventScroll: true })
          })

          finalizeNavigation(shouldScrollToTop)
        } catch (error) {
          if ((error as Error).name === 'AbortError') return
          const message = (error as Error).message || ''
          if (tryRecoverFromStaleModuleGraph(message, urlFull)) return
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
    <RootErrorBoundary onReset={(reset) => { resetErrorBoundary = reset }}>
      <PageContextProvider pageContext={pageContext} setPageContext={setPageContext}>
        {view().Layout ? (
          <Dynamic component={view().Layout ?? undefined}>
            <Dynamic component={view().Page ?? undefined} />
          </Dynamic>
        ) : (
          <Dynamic component={view().Page ?? undefined} />
        )}
      </PageContextProvider>
    </RootErrorBoundary>
  )
}
