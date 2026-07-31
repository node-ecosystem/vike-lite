import { usePageContext } from './usePageContext'

/**
 * Reactive current URL, recomputed whenever `pageContext.urlOriginal` changes.
 */
export function useUrl(): { readonly current: URL } {
  const pageContext = usePageContext()
  return {
    get current() {
      return new URL(pageContext.urlOriginal)
    }
  }
}
