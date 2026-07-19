import { useState, useEffect, useRef, useMemo, useCallback, Component, type ReactNode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import type { PageContextClient } from 'vike-lite'
import { matchRoute, stripBase } from 'vike-lite/__internal/shared'
import { buildInitialClientContext, buildPageContextJsonUrl, consumeMatchingInitialContext, createLinkClickHandler, createLinkPrefetchHandler, createRoutePrefetcher, fetchPageContextJson, finalizeNavigation, loadViewModules, resolveHydrationView, tryRecoverFromStaleModuleGraph, type ViewComponents } from 'vike-lite/__internal/client'
import type { VikeState } from 'vike-lite/__internal/server'

import { PageContextProvider } from '../../hooks/PageContextProvider'

interface RouterProps {
  routes: VikeState['routes']
  errorRoute: VikeState['errorRoute']
  initialView: ViewComponents
  initialContext: PageContextClient
  initialUrl: string
}

// React non ha un ErrorBoundary funzionale nativo — richiede una class component
class RootErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  static getDerivedStateFromError(error: Error) { return { error } }

  override state = { error: null as Error | null }

  override render() {
    if (this.state.error) return <div>Error: {this.state.error.message}</div>
    return this.props.children
  }
}

function RouterApp(props: RouterProps) {
  const [pageContext, setPageContextState] = useState<PageContextClient>(props.initialContext)
  const [view, setView] = useState<ViewComponents>(props.initialView)
  const [currentUrl, setCurrentUrl] = useState(props.initialUrl)
  const [currentPathname, setCurrentPathname] = useState(props.initialContext.urlPathname)
  const [reloadTick, setReloadTick] = useState(0)

  const shouldScrollToTop = useRef(false)
  const pendingContextOverride = useRef<Partial<PageContextClient> | null>(null)
  const reloadResolvers = useRef<Array<() => void>>([])
  const isFirstRun = useRef(true)

  const setPageContext = useCallback((updater: (prev: PageContextClient) => PageContextClient) => {
    setPageContextState(updater)
  }, [])

  const matchedRoute = useMemo(
    () => matchRoute(currentPathname, props.routes),
    [currentPathname, props.routes]
  )

  // Link interception, prefetch, popstate, eventi programmatici
  useEffect(() => {
    const handleLinkClick = createLinkClickHandler((url) => {
      if (!url.hash) shouldScrollToTop.current = true
      setCurrentUrl(url.href)
      setCurrentPathname(stripBase(url.pathname))
    })

    const prefetchRoute = createRoutePrefetcher()

    const handleLinkPrefetch = createLinkPrefetchHandler((url) => {
      const pathname = stripBase(url.pathname)
      const matched = matchRoute(pathname, props.routes)
      if (matched) prefetchRoute(matched.route)
    })

    const handlePopState = () => {
      setCurrentUrl(globalThis.location.href)
      setCurrentPathname(stripBase(globalThis.location.pathname))
    }

    const handleProgrammaticNavigate = (e: Event) => {
      const detail = (e as CustomEvent<{ keepScrollPosition?: boolean; pageContext?: Partial<PageContextClient> }>).detail || {}
      if (!detail.keepScrollPosition) shouldScrollToTop.current = true
      if (detail.pageContext) pendingContextOverride.current = detail.pageContext
      setCurrentUrl(globalThis.location.href)
      setCurrentPathname(stripBase(globalThis.location.pathname))
    }

    const handleProgrammaticReload = (e: Event) => {
      const resolve = (e as CustomEvent<{ resolve?: () => void }>).detail?.resolve
      if (resolve) reloadResolvers.current.push(resolve)
      setReloadTick(t => t + 1)
    }

    document.addEventListener('click', handleLinkClick)
    document.addEventListener('pointerenter', handleLinkPrefetch, { capture: true })
    document.addEventListener('focusin', handleLinkPrefetch)
    globalThis.addEventListener('popstate', handlePopState)
    globalThis.addEventListener('vike-navigate', handleProgrammaticNavigate)
    globalThis.addEventListener('vike-reload', handleProgrammaticReload)

    return () => {
      document.removeEventListener('click', handleLinkClick)
      document.removeEventListener('pointerenter', handleLinkPrefetch, { capture: true })
      document.removeEventListener('focusin', handleLinkPrefetch)
      globalThis.removeEventListener('popstate', handlePopState)
      globalThis.removeEventListener('vike-navigate', handleProgrammaticNavigate)
      globalThis.removeEventListener('vike-reload', handleProgrammaticReload)
    }
  }, [props.routes])

  // Load route
  useEffect(() => {
    const pathname = currentPathname
    const isReload = reloadTick > 0

    if (!isReload && isFirstRun.current && consumeMatchingInitialContext(pathname)) {
      isFirstRun.current = false
      return
    }
    isFirstRun.current = false

    const controller = new AbortController()
    const signal = controller.signal
    const urlFull = currentUrl
    const matched = matchedRoute

    const renderErrorPage = async (is404: boolean, message?: string) => {
      if (!props.errorRoute) return
      const errorView = await loadViewModules(props.errorRoute)
      if (signal.aborted) return
      setPageContext(() => ({
        ...pageContext,
        urlOriginal: urlFull,
        urlPathname: pathname,
        routeParams: {},
        is404,
        is500: !is404,
        errorMessage: message,
        isClientSide: true,
        isHydration: false
      } as PageContextClient))
      setView(errorView)
      document.title = is404 ? 'Not Found' : 'Server Error'
      finalizeNavigation(shouldScrollToTop)
    }

    const loadRoute = async () => {
      const contextOverride = pendingContextOverride.current
      pendingContextOverride.current = null

      if (!matched) return renderErrorPage(true)

      const { route, routeParams } = matched
      try {
        const urlObj = new URL(urlFull)
        const jsonUrl = buildPageContextJsonUrl(pathname, urlObj.search)

        const ctx = (route.data || route.title)
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
          setCurrentUrl(urlObjRedirect.href)
          setCurrentPathname(stripBase(urlObjRedirect.pathname))
          return
        }

        if (ctx && (ctx.is404 || ctx.is500 || ctx.isError)) {
          return renderErrorPage(ctx.is404, ctx.reason || 'Server Error')
        }

        const newView = await loadViewModules(route)

        if (signal.aborted) return

        setPageContext(() => ({
          routeParams,
          urlOriginal: urlObj.href,
          urlPathname: pathname,
          search: urlObj.search,
          ...(ctx?.data && { data: ctx.data }),
          ...(ctx?.title && { title: ctx.title }),
          ...contextOverride,
          isClientSide: true,
          isHydration: false
        } as PageContextClient))
        setView(newView)

        if (ctx?.title) document.title = ctx.title

        requestAnimationFrame(() => {
          if (globalThis.location.hash) return
          document.querySelector<HTMLDivElement>('#root')?.focus({ preventScroll: true })
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
          for (const resolve of reloadResolvers.current) resolve()
          reloadResolvers.current = []
        }
      }
    }

    loadRoute()
    return () => controller.abort()
  }, [currentPathname, currentUrl, matchedRoute, reloadTick])

  const { Page, Layout } = view

  const contextValue = useMemo(
    () => ({ pageContext, setPageContext }),
    [pageContext, setPageContext]
  )

  return (
    <RootErrorBoundary>
      <PageContextProvider value={contextValue}>
        {Layout ? <Layout><Page /></Layout> : <Page />}
      </PageContextProvider>
    </RootErrorBoundary>
  )
}

export async function onRenderClient(clientOptions: {
  routes: VikeState['routes'],
  errorRoute: VikeState['errorRoute'],
  hydration: boolean
}) {
  const container = document.querySelector('#root') as HTMLDivElement
  const isHydration = clientOptions.hydration && !!globalThis.__PAGE_CONTEXT__
  const initialContext = buildInitialClientContext(globalThis.__PAGE_CONTEXT__, isHydration) as PageContextClient
  const initialView = await resolveHydrationView(initialContext, isHydration, clientOptions.routes, clientOptions.errorRoute)

  const app = (
    <RouterApp
      {...clientOptions}
      initialView={initialView}
      initialContext={initialContext}
      initialUrl={globalThis.location.href}
    />
  )

  if (isHydration) {
    hydrateRoot(container, app)
  } else {
    container.replaceChildren()
    createRoot(container).render(app)
  }
}
