import { computed, type ComputedRef } from 'vue'

import { usePageContext } from './usePageContext'

export function useUrl(): ComputedRef<URL> {
  const pageContext = usePageContext()
  // computed() recalculates only when pageContext.urlOriginal changes,
  // not on every other mutation of the context — same granularity as useData
  return computed(() => new URL(pageContext.urlOriginal))
}
