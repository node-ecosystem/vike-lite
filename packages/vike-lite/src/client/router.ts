import type { PageContext } from '..'

/**
 * Change page programmatically on the client without reloading the browser.
 * 
 * @example navigate('/dashboard')
 */
export function navigate(
  url: string,
  options?: {
    keepScrollPosition?: boolean,
    pageContext?: Partial<PageContext>
  }
) {
  if (typeof globalThis === 'undefined') {
    throw new Error('navigate() can only be called on the client side.')
  }

  let finalUrl = url
  if (finalUrl.startsWith('/')) {
    const { BASE_URL } = import.meta.env
    const baseNoSlash = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL
    finalUrl = baseNoSlash + (finalUrl === '/' ? '' : finalUrl)
  }

  // Change the URL in the address bar
  globalThis.history.pushState({ triggeredBy: 'vike-lite' }, '', finalUrl)

  // Notify the vike-lite router to update:
  // dispatch a custom event instead of popstate, passing the options
  globalThis.dispatchEvent(new CustomEvent('vike-navigate', {
    detail: {
      keepScrollPosition: options?.keepScrollPosition,
      pageContext: options?.pageContext
    }
  }))
}

export const reload = (): Promise<void> => {
  return new Promise((resolve) => {
    globalThis.dispatchEvent(
      new CustomEvent('vike-reload', { detail: { resolve } })
    )
  })
}
