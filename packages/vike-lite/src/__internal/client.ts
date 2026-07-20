import type { VikeState } from '../server/store'
import { BASE_URL, matchRoute } from './shared'

function getClientSideUrl(target: HTMLAnchorElement | null): URL | null {
  if (
    !target?.href
    // Ignore if the link has a target that is not _self (e.g. _blank)
    || (target.target && target.target !== '_self')
    // Ignore download and opt-out
    || target.hasAttribute('download')
    || target.hasAttribute('data-native')
    || target.getAttribute('rel')?.includes('external')
  ) return null
  try {
    const url = new URL(target.href, globalThis.location.href)
    // Ignore strange protocols (mailto:, blob:) and external links (google.com)
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.origin !== globalThis.location.origin) return null
    return url
  } catch {
    return null // Invalid URL
  }
}

function isSamePage(url: URL): boolean {
  // If it's a link to the SAME exact page (only the hash changes)
  // Let the browser handle it natively! (It will jump to the correct ID by itself)
  return (url.pathname === globalThis.location.pathname && url.search === globalThis.location.search)
}

export function createLinkClickHandler(onNavigate: (url: URL) => void) {
  return (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || !(e.target instanceof Element)) return

    const target = (e.target as HTMLElement).closest<HTMLAnchorElement>('a')
    const url = getClientSideUrl(target)
    if (!url || isSamePage(url)) return

    e.preventDefault()
    globalThis.history.pushState({ triggeredBy: 'vike-lite' }, '', url.href)
    onNavigate(url)
  }
}

export function createLinkPrefetchHandler(onPrefetch: (url: URL) => void) {
  return (e: Event) => {
    if (!(e.target instanceof Element)) return
    const target = (e.target as HTMLElement).closest<HTMLAnchorElement>('a')
    const url = getClientSideUrl(target)
    if (!url || isSamePage(url)) return

    onPrefetch(url)
  }
}

// Scroll only when the content is ready
export function finalizeNavigation(shouldScrollToTop: { current: boolean }) {
  if (shouldScrollToTop.current) {
    globalThis.scrollTo(0, 0)
    shouldScrollToTop.current = false
  } else if (globalThis.location.hash) {
    // If there's a hash in the URL, wait for the new DOM to be physically on screen
    // and try to scroll to the element
    requestAnimationFrame(() => {
      try { document.querySelector<HTMLElement>(decodeURIComponent(globalThis.location.hash))?.scrollIntoView() } catch { }
    })
  }
}

export interface ViewComponents<TComponent = unknown> {
  Page: TComponent | null
  Layout: TComponent | null
  Head: TComponent | null
}

/**
 * Shape of a dynamically-imported `+Page`/`+Layout`/`+Head` module. The actual
 * component type isn't statically known here (it's whatever the framework
 * adapter's JSX/template runtime expects) — callers of `loadViewModules`
 * specify it via the `TComponent` type param instead.
 */
interface ViewModule {
  default?: unknown
  Page?: unknown
  Layout?: unknown
  Head?: unknown
}

interface RouteModuleLoaders {
  Page: () => Promise<ViewModule>
  Layout?: () => Promise<ViewModule>
  Head?: () => Promise<ViewModule>
}

/**
 * Load a route's Page/Layout/Head modules in parallel and resolve each
 * module's export (named export first, falling back to the default export).
 */
export async function loadViewModules<TComponent = unknown>(
  route: RouteModuleLoaders
): Promise<ViewComponents<TComponent>> {
  const [PageMod, LayoutMod, HeadMod] = await Promise.all([
    route.Page(),
    route.Layout?.() ?? null,
    route.Head?.() ?? null
  ])
  return {
    Page: (PageMod.Page ?? PageMod.default ?? null) as TComponent | null,
    Layout: (LayoutMod?.Layout ?? LayoutMod?.default ?? null) as TComponent | null,
    Head: (HeadMod?.Head ?? HeadMod?.default ?? null) as TComponent | null
  }
}

/**
 * Build the URL of the `+data`/`+title` JSON endpoint for a given pathname
 * (e.g. base "/my-app" and path "/about" → "/my-app/about.pageContext.json").
 */
export function buildPageContextJsonUrl(pathname: string, search: string): string {
  const jsonTarget = pathname === '/' ? '/index' : pathname
  return `${BASE_URL}${jsonTarget}.pageContext.json${search}`
}

/** Shape of a `.pageContext.json` payload as produced by the server-side `+data`/`+title` hooks. */
export interface PageContextJson {
  data?: unknown
  title?: string
  is404?: boolean
  is500?: boolean
  isError?: boolean
  reason?: string
  _redirect?: string
}

/**
 * Fetch and parse a `.pageContext.json` endpoint, throwing a descriptive error
 * if a proxy/CDN intercepted the request with a non-JSON response.
 */
export async function fetchPageContextJson(
  jsonUrl: string,
  options: { signal: AbortSignal; cache?: RequestCache }
): Promise<PageContextJson> {
  const res = await fetch(jsonUrl, options)
  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    throw new Error(`Expected JSON but got "${contentType}" for ${jsonUrl}. Check your proxy/CDN configuration.`)
  }
  return res.json()
}

interface PrefetchableRoute {
  page?: string
  layout?: string
  head?: string
  Page?: () => Promise<unknown>
  Layout?: () => Promise<unknown>
  Head?: () => Promise<unknown>
}

/**
 * Create a per-router-instance prefetcher that loads a route's modules at most once
 * (e.g. on link hover/focus), retrying later if the load failed.
 */
export function createRoutePrefetcher() {
  const prefetchedModules = new Set<string>()
  return function prefetchRoute(route: PrefetchableRoute) {
    const modules: Array<[string | undefined, (() => Promise<unknown>) | undefined]> = [
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
}

const STALE_MODULE_GRAPH_PATTERN = /dynamically imported module|importing a module script failed/i
const RELOAD_GUARD_KEY = 'vike-lite:reload-guard'
const RELOAD_GUARD_WINDOW_MS = 10_000

/**
 * Detect a stale module graph error (dev server restarted / new build deployed) and
 * force a full browser reload, guarded against reload loops via sessionStorage.
 * Returns true if a reload was triggered — the caller should stop further error handling.
 */
export function tryRecoverFromStaleModuleGraph(message: string, urlToReload: string): boolean {
  if (!STALE_MODULE_GRAPH_PATTERN.test(message)) return false
  const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) ?? 0)
  if (Date.now() - last <= RELOAD_GUARD_WINDOW_MS) return false
  sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()))
  console.warn('App update detected, forcing reload…')
  globalThis.location.assign(urlToReload)
  return true
}

/**
 * Stamp the client-only flags that every `PageContextClient` requires (`isClientSide`,
 * `isHydration`) onto the raw context blob the server injected via `window.__PAGE_CONTEXT__`.
 * Centralized so every adapter sets these consistently instead of some silently omitting them.
 */
export function buildInitialClientContext<T extends object>(
  rawContext: T | undefined,
  isHydration: boolean
): T & { isClientSide: true; isHydration: boolean } {
  return {
    ...(rawContext ?? {} as T),
    isClientSide: true,
    isHydration
  }
}

interface HydrationInitialContext {
  urlPathname?: string
  is404?: boolean
  is500?: boolean
  errorMessage?: string
}

/**
 * Resolve the Page/Layout/Head modules to hydrate with, matching what the server
 * actually rendered into the HTML: the error route's modules when the server
 * reported a 404/500/error, otherwise the modules of the route matching the
 * initial pathname. Returns a null view when hydration isn't happening (client
 * takeover) — the router's own first-load effect performs the initial load instead.
 */
export async function resolveHydrationView<TComponent = unknown>(
  initialContext: HydrationInitialContext,
  isHydration: boolean,
  routes: VikeState['routes'],
  errorRoute: VikeState['errorRoute']
): Promise<ViewComponents<TComponent>> {
  const emptyView: ViewComponents<TComponent> = { Page: null, Layout: null, Head: null }
  if (!isHydration) return emptyView

  if (errorRoute && (initialContext.is404 || initialContext.is500 || initialContext.errorMessage)) {
    return loadViewModules<TComponent>(errorRoute)
  }

  const pathname = initialContext.urlPathname ?? globalThis.location.pathname
  const matched = matchRoute(pathname, routes)
  return matched ? loadViewModules<TComponent>(matched.route) : emptyView
}

/**
 * Consume the server-injected initial context if it still matches the given pathname
 * (i.e. this is the very first client-side route load, right after SSR hydration/render).
 * Clears the global reference so a later remount at the same pathname (e.g. React
 * StrictMode double-invoke in dev) triggers a real fetch instead of being mistaken
 * for the original initial load. Returns true if consumed — the caller should skip
 * loading for this run.
 */
export function consumeMatchingInitialContext(pathname: string): boolean {
  if (globalThis.__PAGE_CONTEXT__?.urlPathname !== pathname) return false
  globalThis.__PAGE_CONTEXT__ = undefined
  return true
}
