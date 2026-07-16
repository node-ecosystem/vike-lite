import { useState, useEffect, useRef, useMemo, useCallback, Component, type ReactNode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import type { PageContextClient } from 'vike-lite'
import { matchRoute } from 'vike-lite/__internal/shared'
import type { VikeState } from 'vike-lite/__internal/server'

import { PageContextProvider } from '../../hooks/PageContextProvider'
import { stripBase } from '../shared/stripBase'

interface ViewComponents {
  Page: any | null
  Layout: any | null
  Head: any | null
}

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

  state = { error: null as Error | null }

  render() {
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
    const handleLinkClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a')
      if (!target?.href || target.target === '_blank' || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
      const url = new URL(target.href)
      if (url.origin !== globalThis.location.origin) return
      const isSamePage = url.pathname === globalThis.location.pathname && url.search === globalThis.location.search
      if (isSamePage) return
      e.preventDefault()
      globalThis.history.pushState({ triggeredBy: 'vike-lite' }, '', url.href)
      if (!url.hash) shouldScrollToTop.current = true
      setCurrentUrl(url.href)
      setCurrentPathname(stripBase(url.pathname))
    }

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

    const handleLinkPrefetch = (e: Event) => {
      const target = (e.target as HTMLElement).closest<HTMLAnchorElement>('a')
      if (!target?.href) return
      if (target.target && target.target !== '_self') return
      if (target.hasAttribute('download')) return
      const url = new URL(target.href)
      if (url.origin !== globalThis.location.origin) return
      const isSamePage = url.pathname === globalThis.location.pathname && url.search === globalThis.location.search
      if (isSamePage) return
      const matched = matchRoute(stripBase(url.pathname), props.routes)
      if (!matched) return
      prefetchRoute(matched.route)
    }

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

  // Caricamento route
  useEffect(() => {
    const pathname = currentPathname
    const isReload = reloadTick > 0

    if (isFirstRun.current && !isReload && globalThis.__PAGE_CONTEXT__?.urlPathname === pathname) {
      isFirstRun.current = false
      globalThis.__PAGE_CONTEXT__!.urlPathname = undefined as any
      return
    }
    isFirstRun.current = false

    const controller = new AbortController()
    const signal = controller.signal
    const urlFull = currentUrl
    const matched = matchedRoute

    const loadRoute = async () => {
      const contextOverride = pendingContextOverride.current
      pendingContextOverride.current = null

      function finalizeNavigation() {
        if (shouldScrollToTop.current) {
          globalThis.scrollTo(0, 0)
          shouldScrollToTop.current = false
        } else if (globalThis.location.hash) {
          requestAnimationFrame(() => {
            try { document.querySelector<HTMLElement>(decodeURIComponent(globalThis.location.hash))?.scrollIntoView() } catch { }
          })
        }
      }

      const renderErrorPage = async (is404: boolean, message?: string) => {
        if (!props.errorRoute) return
        const [ErrorPageMod, ErrorLayoutMod, ErrorHeadMod] = await Promise.all([
          props.errorRoute.Page(),
          props.errorRoute.Layout?.() ?? null,
          props.errorRoute.Head?.() ?? null
        ])
        if (signal.aborted) return
        setPageContext(() => ({
          urlOriginal: urlFull,
          urlPathname: pathname,
          routeParams: {},
          is404,
          is500: !is404,
          errorMessage: message,
          isClientSide: true,
          isHydration: false
        } as PageContextClient))
        setView({
          Page: ErrorPageMod.Page ?? ErrorPageMod.default,
          Layout: ErrorLayoutMod?.Layout ?? ErrorLayoutMod?.default ?? null,
          Head: ErrorHeadMod?.Head ?? ErrorHeadMod?.default ?? null
        })
        document.title = is404 ? 'Not Found' : 'Server Error'
        finalizeNavigation()
      }

      if (!matched) return renderErrorPage(true)

      const { route, routeParams } = matched
      try {
        const urlObj = new URL(urlFull)
        const jsonTarget = pathname === '/' ? '/index' : pathname
        const { BASE_URL } = import.meta.env
        const baseNoSlash = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL
        const jsonUrl = `${baseNoSlash}${jsonTarget}.pageContext.json${urlObj.search}`

        let ctx: any = null
        if (route.data || route.title) {
          const res = await fetch(jsonUrl, { signal, cache: isReload ? 'no-cache' : 'default' })
          const contentType = res.headers.get('content-type') ?? ''
          if (!contentType.includes('application/json')) {
            throw new Error(`Expected JSON but got "${contentType}" for ${jsonUrl}. Check your proxy/CDN configuration.`)
          }
          ctx = await res.json()
        }

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

        const [PageMod, LayoutMod, HeadMod] = await Promise.all([
          route.Page(),
          route.Layout?.() ?? null,
          route.Head?.() ?? null
        ])

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
        setView({
          Page: PageMod.Page ?? PageMod.default,
          Layout: LayoutMod?.Layout ?? LayoutMod?.default ?? null,
          Head: HeadMod?.Head ?? HeadMod?.default ?? null
        })

        if (ctx?.title) document.title = ctx.title

        requestAnimationFrame(() => {
          if (globalThis.location.hash) return
          document.querySelector<HTMLDivElement>('#root')?.focus({ preventScroll: true })
        })

        finalizeNavigation()
      } catch (error) {
        if ((error as Error).name === 'AbortError') return

        const message = (error as Error).message || ''
        const isStaleModuleGraph = /dynamically imported module|importing a module script failed/i.test(message)
        if (isStaleModuleGraph) {
          const GUARD_KEY = 'vike-lite:reload-guard'
          const last = Number(sessionStorage.getItem(GUARD_KEY) ?? 0)
          if (Date.now() - last > 10_000) {
            sessionStorage.setItem(GUARD_KEY, String(Date.now()))
            console.warn('App update detected, forcing reload…')
            globalThis.location.assign(urlFull)
            return
          }
        }

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
  const rawContext = globalThis.__PAGE_CONTEXT__ ?? ({} as PageContextClient)
  const isHydration = clientOptions.hydration && !!globalThis.__PAGE_CONTEXT__

  const initialContext = {
    ...rawContext,
    isClientSide: true,
    isHydration
  } as PageContextClient
  let initialView: ViewComponents = { Page: null, Layout: null, Head: null }

  if (isHydration) {
    const pathname = initialContext.urlPathname ?? globalThis.location.pathname
    const matched = matchRoute(pathname, clientOptions.routes)
    if (matched) {
      const [PageMod, LayoutMod, HeadMod] = await Promise.all([
        matched.route.Page(),
        matched.route.Layout?.() ?? null,
        matched.route.Head?.() ?? null
      ])
      initialView = {
        Page: PageMod.Page ?? PageMod.default,
        Layout: LayoutMod?.Layout ?? LayoutMod?.default ?? null,
        Head: HeadMod?.Head ?? HeadMod?.default ?? null
      }
    }
  }

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
