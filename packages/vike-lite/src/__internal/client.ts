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
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return

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
    const target = (e.target as HTMLElement).closest<HTMLAnchorElement>('a')
    const url = getClientSideUrl(target)
    if (!url || isSamePage(url)) return

    onPrefetch(url)
  }
}

// Scroll only when the content is ready
export function finalizeNavigation(shouldScrollToTop: boolean) {
  if (shouldScrollToTop) {
    globalThis.scrollTo(0, 0)
    shouldScrollToTop = false
  } else if (globalThis.location.hash) {
    // If there's a hash in the URL, wait for the new DOM to be physically on screen
    // and try to scroll to the element
    requestAnimationFrame(() => {
      try { document.querySelector<HTMLElement>(decodeURIComponent(globalThis.location.hash))?.scrollIntoView() } catch { }
    })
  }
}

export const BASE_URL = (() => {
  const { BASE_URL } = import.meta.env
  return BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL
})()

export function stripBase(pathname: string): string {
  if (BASE_URL === '') return pathname
  if (pathname === BASE_URL) return '/'
  if (pathname.startsWith(BASE_URL + '/')) return pathname.slice(BASE_URL.length)
  return pathname
}
