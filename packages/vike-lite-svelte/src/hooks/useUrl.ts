import { usePageContext } from './usePageContext'

/**
 * Reactive current URL, recomputed whenever `pageContext.urlOriginal` changes.
 */
export function useUrl(): { readonly current: URL } {
  const pageContext = usePageContext()
  const url = $derived(new URL(pageContext.urlOriginal))
  return { get current() { return url } }
}
