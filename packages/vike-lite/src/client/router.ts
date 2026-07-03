import { BASE_URL } from '../shared'

/**
 * Change page programmatically on the client without reloading the browser.
 * 
 * @example navigate('/dashboard')
 */
export function navigate(url: string, options?: { keepScrollPosition?: boolean }) {
  if (typeof globalThis === 'undefined') {
    throw new Error('navigate() can only be called on the client side.')
  }

  let finalUrl = url
  if (finalUrl.startsWith('/')) {
    const baseNoSlash = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL
    finalUrl = baseNoSlash + (finalUrl === '/' ? '' : finalUrl)
  }

  // Change the URL in the address bar
  globalThis.history.pushState(null, '', finalUrl)

  // Notify the vike-lite router to update
  globalThis.dispatchEvent(new Event('popstate'))

  // Reset scroll as if it were a normal page load
  if (!options?.keepScrollPosition) {
    globalThis.scrollTo(0, 0)
  }
}
