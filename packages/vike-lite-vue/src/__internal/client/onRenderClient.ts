import { createSSRApp, reactive, ref, computed, h, defineComponent, onMounted, onUnmounted, type Component, watch, onErrorCaptured, provide } from 'vue'
import type { PageContextClient } from 'vike-lite'
import { matchRoute } from 'vike-lite/__internal/shared'
import { BASE_URL, createLinkClickHandler, createLinkPrefetchHandler, finalizeNavigation, stripBase } from 'vike-lite/__internal/client'
import type { VikeState } from 'vike-lite/__internal/server'

import { pageContextInjectionKey } from '../../hooks/globalContext'

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

  const shouldScrollToTop = { value: false }
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
      if (!(Object.hasOwn(next, key))) delete (pageContext as any)[key]
    }
    Object.assign(pageContext, next)
  }

  async function loadRoute() {
    abortController?.abort()
    const controller = new AbortController()
    abortController = controller
    const signal = controller.signal

    const pathname = currentPathname.value
    const urlFull = currentUrl.value
    const isReload = reloadTick.value > 0
    const matched = matchedRoute.value

    const contextOverride = pendingContextOverride.value
    pendingContextOverride.value = null

    const renderErrorPage = async (is404: boolean, message?: string) => {
      if (!props.errorRoute) return
      const [ErrorPageMod, ErrorLayoutMod, ErrorHeadMod] = await Promise.all([
        props.errorRoute.Page(),
        props.errorRoute.Layout?.() ?? null,
        props.errorRoute.Head?.() ?? null
      ])
      if (signal.aborted) return
      setPageContext({
        ...pageContext,
        urlOriginal: urlFull, urlPathname: pathname, routeParams: {},
        is404, is500: !is404, errorMessage: message
      } as PageContextClient)
      view.value = {
        Page: ErrorPageMod.Page ?? ErrorPageMod.default,
        Layout: ErrorLayoutMod?.Layout ?? ErrorLayoutMod?.default ?? null,
        Head: ErrorHeadMod?.Head ?? ErrorHeadMod?.default ?? null
      }
      document.title = is404 ? 'Not Found' : 'Server Error'
      finalizeNavigation(shouldScrollToTop.value)
    }

    if (!matched) return renderErrorPage(true)

    const { route, routeParams } = matched
    try {
      const urlObj = new URL(urlFull)
      const jsonTarget = pathname === '/' ? '/index' : pathname
      const jsonUrl = `${BASE_URL}${jsonTarget}.pageContext.json${urlObj.search}`

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
        shouldScrollToTop.value = true
        currentUrl.value = urlObjRedirect.href
        currentPathname.value = stripBase(urlObjRedirect.pathname)
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

      setPageContext({
        routeParams,
        urlOriginal: urlObj.href,
        urlPathname: pathname,
        search: urlObj.search,
        ...(ctx?.data && { data: ctx.data }),
        ...(ctx?.title && { title: ctx.title }),
        ...contextOverride
      } as PageContextClient)
      view.value = {
        Page: PageMod.Page ?? PageMod.default,
        Layout: LayoutMod?.Layout ?? LayoutMod?.default ?? null,
        Head: HeadMod?.Head ?? HeadMod?.default ?? null
      }

      if (ctx?.title) document.title = ctx.title

      requestAnimationFrame(() => {
        if (globalThis.location.hash) return
        document.querySelector<HTMLDivElement>('#root')?.focus({ preventScroll: true })
      })

      finalizeNavigation(shouldScrollToTop.value)
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
      if (!url.hash) shouldScrollToTop.value = true
      currentUrl.value = url.href
      currentPathname.value = stripBase(url.pathname)
    })

    const prefetchedModules = new Set<string>()
    function prefetchRoute(route: VikeState['routes'][number]) {
      const modules: Array<[string | undefined, (() => Promise<any>) | undefined]> = [
        [route.page, route.Page], [route.layout, route.Layout], [route.head, route.Head]
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
      currentUrl.value = globalThis.location.href
      currentPathname.value = stripBase(globalThis.location.pathname)
    }

    const handleProgrammaticNavigate = (e: Event) => {
      const detail = (e as CustomEvent<{ keepScrollPosition?: boolean; pageContext?: Partial<PageContextClient> }>).detail || {}
      if (!detail.keepScrollPosition) shouldScrollToTop.value = true
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
    if (isFirstRun && reloadTick.value === 0 && globalThis.__PAGE_CONTEXT__?.urlPathname === pathname) {
      isFirstRun = false
      globalThis.__PAGE_CONTEXT__!.urlPathname = undefined as any
      return
    }
    isFirstRun = false
    loadRoute()
  })

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
  const initialContext = globalThis.__PAGE_CONTEXT__ ?? ({} as PageContextClient)
  const isHydration = clientOptions.hydration && !!globalThis.__PAGE_CONTEXT__

  let initialView: ViewComponents = { Page: null, Layout: null, Head: null }

  if (isHydration)
    if ((initialContext.is404 || initialContext.is500) && clientOptions.errorRoute) {
      const [PageMod, LayoutMod, HeadMod] = await Promise.all([
        clientOptions.errorRoute.Page(),
        clientOptions.errorRoute.Layout?.() ?? null,
        clientOptions.errorRoute.Head?.() ?? null
      ])
      initialView = {
        Page: PageMod.Page ?? PageMod.default,
        Layout: LayoutMod?.Layout ?? LayoutMod?.default ?? null,
        Head: HeadMod?.Head ?? HeadMod?.default ?? null
      }
    } else {
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

  const app = createSSRApp(RouterApp, {
    ...clientOptions,
    initialView,
    initialContext,
    initialUrl: globalThis.location.href
  })

  if (!isHydration) container.replaceChildren()
  app.mount(container)
}
