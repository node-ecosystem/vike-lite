<script lang="ts">
  import { setContext, onMount, type Component } from 'svelte'
  import type { PageContextClient } from 'vike-lite'
  import { matchRoute, stripBase } from 'vike-lite/__internal/shared'
  import {
    buildPageContextJsonUrl, consumeMatchingInitialContext, createLinkClickHandler,
    createLinkPrefetchHandler, createRoutePrefetcher, fetchPageContextJson, finalizeNavigation,
    loadViewModules, tryRecoverFromStaleModuleGraph
  } from 'vike-lite/__internal/client'
  import type { VikeState } from 'vike-lite/__internal/server'

  import { pageContextKey, type InternalContextValue } from '../../shared/globalContext'

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

  let { routes, errorRoute, initialView, initialContext, initialUrl }: RouterProps = $props()

  const pageContext = $state<PageContextClient>({ ...initialContext })

  setContext(pageContextKey, { get pageContext() { return pageContext } } satisfies InternalContextValue)

  let view = $state<ViewComponents>(initialView)
  let currentUrl = $state(initialUrl)
  let currentPathname = $state(initialContext.urlPathname)
  let reloadTick = $state(0)
  function onBoundaryError(e: unknown) {
    console.error('Render Error:', e)
  }

  // Plain mutable variables (NOT runes — intentionally non-reactive, mirrors the
  // equivalent "plain object" pattern used in vike-lite-vue/vike-lite-react)
  const shouldScrollToTop = { current: false }
  const pendingContextOverride: { value: Partial<PageContextClient> | null } = { value: null }
  const reloadResolvers: Array<() => void> = []
  let isFirstRun = true
  let abortController: AbortController | null = null

  const matchedRoute = $derived(matchRoute(currentPathname, routes))

  function setPageContext(next: Partial<PageContextClient>) {
    // Optimization: only remove old keys that are not in the new state, so we don't
    // temporarily delete keys and break dependents reading the reactive object
    for (const key of Object.keys(pageContext)) {
      if (!(Object.hasOwn(next, key))) delete (pageContext as Record<string, unknown>)[key]
    }
    Object.assign(pageContext, next)
  }

  async function loadRoute() {
    abortController?.abort()
    const controller = new AbortController()
    abortController = controller
    const signal = controller.signal

    const pathname = currentPathname
    const urlFull = currentUrl
    const isReload = reloadTick > 0
    const matched = matchedRoute

    const contextOverride = pendingContextOverride.value
    pendingContextOverride.value = null

    const renderErrorPage = async (is404: boolean, message?: string) => {
      if (!errorRoute) return
      const errorView = await loadViewModules<Component>(errorRoute)
      if (signal.aborted) return
      setPageContext({
        ...pageContext,
        urlOriginal: urlFull, urlPathname: pathname, routeParams: {},
        is404, is500: !is404, errorMessage: message
      } as PageContextClient)
      view = errorView
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
        currentUrl = urlObjRedirect.href
        currentPathname = stripBase(urlObjRedirect.pathname)
        return
      }

      if (ctx && (ctx.is404 || ctx.is500 || ctx.isError)) {
        return renderErrorPage(ctx.is404 ?? false, ctx.reason || 'Server Error')
      }

      const newView = await loadViewModules<Component>(route)

      if (signal.aborted) return

      setPageContext({
        routeParams,
        urlOriginal: urlObj.href,
        urlPathname: pathname,
        search: urlObj.search,
        ...(ctx?.data !== undefined ? { data: ctx.data } : {}),
        ...(ctx?.title ? { title: ctx.title } : {}),
        ...contextOverride
      } as PageContextClient)
      view = newView

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
    reloadTick++
  }

  onMount(() => {
    const handleLinkClick = createLinkClickHandler((url) => {
      if (!url.hash) shouldScrollToTop.current = true
      currentUrl = url.href
      currentPathname = stripBase(url.pathname)
    })

    const prefetchRoute = createRoutePrefetcher()

    const handleLinkPrefetch = createLinkPrefetchHandler((url) => {
      const pathname = stripBase(url.pathname)
      const matched = matchRoute(pathname, routes)
      if (matched) prefetchRoute(matched.route)
    })

    const handlePopState = () => {
      currentUrl = globalThis.location.href
      currentPathname = stripBase(globalThis.location.pathname)
    }

    const handleProgrammaticNavigate = (e: Event) => {
      const detail = (e as CustomEvent<{ keepScrollPosition?: boolean; pageContext?: Partial<PageContextClient> }>).detail || {}
      if (!detail.keepScrollPosition) shouldScrollToTop.current = true
      if (detail.pageContext) pendingContextOverride.value = detail.pageContext
      currentUrl = globalThis.location.href
      currentPathname = stripBase(globalThis.location.pathname)
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
  })

  // Reacts to changes of currentPathname/currentUrl/reloadTick (and runs once
  // immediately on mount, like Vue's `watch(..., { immediate: true })`)
  $effect(() => {
    const pathname = currentPathname
    void currentUrl
    void reloadTick

    if (isFirstRun && reloadTick === 0 && consumeMatchingInitialContext(pathname)) {
      isFirstRun = false
      return
    }
    isFirstRun = false
    loadRoute()
  })
</script>

<svelte:boundary onerror={onBoundaryError}>
  {#if view.Page}
    {#if view.Layout}
      {@const Layout = view.Layout}
      {@const Page = view.Page}
      <Layout>
        <Page />
      </Layout>
    {:else}
      {@const Page = view.Page}
      <Page />
    {/if}
  {/if}

  {#snippet failed(error)}
    <div>Error: {(error as Error).message}</div>
  {/snippet}
</svelte:boundary>
