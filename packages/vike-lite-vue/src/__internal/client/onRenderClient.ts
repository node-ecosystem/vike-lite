import { createSSRApp, reactive, ref, computed, h, defineComponent, onMounted, onUnmounted, type Component, watch, onErrorCaptured, provide } from 'vue'
import type { PageContextClient } from 'vike-lite'
import { matchRoute, stripBase } from 'vike-lite/__internal/shared'
import { buildInitialClientContext, buildNavigationPageContext, buildPageContextJsonUrl, consumeMatchingInitialContext, createLinkClickHandler, createLinkPrefetchHandler, createRoutePrefetcher, fetchPageContextJson, finalizeNavigation, loadViewModules, resolveHydrationView, tryRecoverFromStaleModuleGraph } from 'vike-lite/__internal/client'
import type { VikeState } from 'vike-lite/__internal/server'

import { pageContextInjectionKey } from '../../shared/globalContext'

interface ViewComponents {
  Page: Component | null
  Layout: Component | null
  Head: Component | null
}

interface RouterProps {
  routes: VikeState['routes']
  errorRoute: VikeState['errorRoute']
  initialView: ViewComponents
  initialContext: PageContextClient
  initialUrl: string
}

const RouterApp = defineComponent<RouterProps>((props) => {
  const pageContext = reactive<PageContextClient>({ ...props.initialContext })

  provide(pageContextInjectionKey, { pageContext })

  const view = ref<ViewComponents>(props.initialView)
  const currentUrl = ref(props.initialUrl)
  const currentPathname = ref(props.initialContext.urlPathname)
  const reloadTick = ref(0)

  // Plain mutable object (NOT a Vue ref / Solid signal — intentionally non-reactive)
  const shouldScrollToTop = { current: false }
  const pendingContextOverride = { value: null as Partial<PageContextClient> | null }
  const reloadResolvers: Array<() => void> = []
  let isFirstRun = true
  let abortController: AbortController | null = null
  const renderError = ref<Error | null>(null)

  const matchedRoute = computed(() => matchRoute(currentPathname.value, props.routes))

  function setPageContext(next: Partial<PageContextClient>) {
    // Optimization: We only remove old keys that are not in the new state
    // This prevents temporarily deleting keys and breaking child computed properties
    for (const key of Object.keys(pageContext)) {
      if (!(Object.hasOwn(next, key))) delete (pageContext as Record<string, unknown>)[key]
    }
    Object.assign(pageContext, next)
  }

  async function loadRoute() {
    abortController?.abort()
    const controller = new AbortController()
    abortController = controller
    // Clear any error from a previous render attempt before starting a new navigation
    renderError.value = null
    const signal = controller.signal

    const pathname = currentPathname.value
    const urlFull = currentUrl.value
    const isReload = reloadTick.value > 0
    const matched = matchedRoute.value

    const contextOverride = pendingContextOverride.value
    pendingContextOverride.value = null

    const renderErrorPage = async (is404: boolean, message?: string) => {
      if (!props.errorRoute) return
      const errorView = await loadViewModules<Component>(props.errorRoute)
      if (signal.aborted) return
      setPageContext({
        ...pageContext,
        urlOriginal: urlFull, urlPathname: pathname, routeParams: {},
        is404, is500: !is404, errorMessage: message
      } as PageContextClient)
      view.value = errorView
      document.title = is404 ? 'Not Found' : 'Server Error'
      finalizeNavigation(shouldScrollToTop)
    }

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
        currentUrl.value = urlObjRedirect.href
        currentPathname.value = stripBase(urlObjRedirect.pathname)
        return
      }

      if (ctx && (ctx.is404 || ctx.is500 || ctx.isError)) {
        return renderErrorPage(ctx.is404 ?? false, ctx.reason || 'Server Error')
      }

      const newView = await loadViewModules<Component>(route)

      if (signal.aborted) return

      setPageContext(buildNavigationPageContext({
        routeParams,
        urlOriginal: urlObj.href,
        urlPathname: pathname,
        search: urlObj.search,
        ...(ctx?.data !== undefined ? { data: ctx.data } : {}),
        ...(ctx?.title ? { title: ctx.title } : {}),
        ...contextOverride
      }) as PageContextClient)
      view.value = newView

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
        for (const resolve of reloadResolvers) resolve()
        reloadResolvers.length = 0
      }
    }
  }

  const handleProgrammaticReload = (e: Event) => {
    const resolve = (e as CustomEvent<{ resolve?: () => void }>).detail?.resolve
    if (resolve) reloadResolvers.push(resolve)
    reloadTick.value++
  }

  onMounted(() => {
    const handleLinkClick = createLinkClickHandler((url) => {
      if (!url.hash) shouldScrollToTop.current = true
      currentUrl.value = url.href
      currentPathname.value = stripBase(url.pathname)
    })

    const prefetchRoute = createRoutePrefetcher()

    const handleLinkPrefetch = createLinkPrefetchHandler((url) => {
      const pathname = stripBase(url.pathname)
      const matched = matchRoute(pathname, props.routes)
      if (matched) prefetchRoute(matched.route)
    })

    const handlePopState = () => {
      currentUrl.value = globalThis.location.href
      currentPathname.value = stripBase(globalThis.location.pathname)
    }

    const handleProgrammaticNavigate = (e: Event) => {
      const detail = (e as CustomEvent<{ keepScrollPosition?: boolean; pageContext?: Partial<PageContextClient> }>).detail || {}
      if (!detail.keepScrollPosition) shouldScrollToTop.current = true
      if (detail.pageContext) pendingContextOverride.value = detail.pageContext
      currentUrl.value = globalThis.location.href
      currentPathname.value = stripBase(globalThis.location.pathname)
    }

    document.addEventListener('click', handleLinkClick)
    document.addEventListener('pointerenter', handleLinkPrefetch, { capture: true })
    document.addEventListener('focusin', handleLinkPrefetch)
    globalThis.addEventListener('popstate', handlePopState)
    globalThis.addEventListener('vike-navigate', handleProgrammaticNavigate)
    globalThis.addEventListener('vike-reload', handleProgrammaticReload)

    onUnmounted(() => {
      document.removeEventListener('click', handleLinkClick)
      document.removeEventListener('pointerenter', handleLinkPrefetch, { capture: true })
      document.removeEventListener('focusin', handleLinkPrefetch)
      globalThis.removeEventListener('popstate', handlePopState)
      globalThis.removeEventListener('vike-navigate', handleProgrammaticNavigate)
      globalThis.removeEventListener('vike-reload', handleProgrammaticReload)
    })

    // Vue does not have an automatic isFirstRun helper like Solid/React with initial signals —
    // the first run is already covered by the initialView passed via props, so here
    // we only react to SUCCESSIVE changes of currentPathname/currentUrl/reloadTick
  })

  watch([currentPathname, currentUrl, reloadTick], () => {
    const pathname = currentPathname.value
    if (isFirstRun && reloadTick.value === 0 && consumeMatchingInitialContext(pathname)) {
      isFirstRun = false
      return
    }
    isFirstRun = false
    loadRoute()
  }, { immediate: true })

  onErrorCaptured((err) => {
    renderError.value = err as Error
    return false // stop propagation to avoid Vue's default error handling (which logs the error to console)
  })

  return () => {
    if (renderError.value) return h('div', `Error: ${renderError.value.message}`)
    const { Page, Layout } = view.value
    if (!Page) return null
    return Layout ? h(Layout, null, { default: () => h(Page) }) : h(Page)
  }
}, { props: ['routes', 'errorRoute', 'initialView', 'initialContext', 'initialUrl'] })

export async function onRenderClient(clientOptions: { routes: VikeState['routes'], errorRoute: VikeState['errorRoute'], hydration: boolean }) {
  const container = document.querySelector('#root') as HTMLDivElement
  const isHydration = clientOptions.hydration && !!globalThis.__PAGE_CONTEXT__
  const initialContext = buildInitialClientContext(globalThis.__PAGE_CONTEXT__, isHydration) as PageContextClient
  const initialView = await resolveHydrationView<Component>(initialContext, isHydration, clientOptions.routes, clientOptions.errorRoute)

  const app = createSSRApp(RouterApp, {
    ...clientOptions,
    initialView,
    initialContext,
    initialUrl: globalThis.location.href
  })

  if (!isHydration) container.replaceChildren()
  app.mount(container)
}
