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

  // Notify the vike-lite router to update:
  // dispatch a custom event instead of popstate, passing the options
  globalThis.dispatchEvent(new CustomEvent('vike-navigate', {
    detail: { keepScrollPosition: options?.keepScrollPosition }
  }))
}

export const reload = (): Promise<void> => {
  return new Promise((resolve) => {
    globalThis.dispatchEvent(
      new CustomEvent('vike-reload', { detail: { resolve } })
    )
  })
}
