import { computed, type ComputedRef } from 'vue'

import { usePageContext } from './usePageContext'

export function useUrl(): ComputedRef<URL> {
  const pageContext = usePageContext()
  // computed() recalculates only when pageContext.urlOriginal changes,
  // not on every other mutation of the context — same granularity as useData.
  // The base URL argument is a defensive fallback: urlOriginal is always absolute
  // in practice, but parsing shouldn't rely silently on that internal guarantee.
  return computed(() => new URL(pageContext.urlOriginal, 'http://localhost'))
}
