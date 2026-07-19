import { useMemo } from 'react'
import { usePageContext } from './usePageContext'

export function useUrl(): URL {
  const pageContext = usePageContext()
  // The base URL argument is a defensive fallback:
  // urlOriginal is always absolute in practice,
  // but parsing shouldn't rely silently on that internal guarantee.
  return useMemo(() => new URL(pageContext.urlOriginal, 'http://localhost'), [pageContext.urlOriginal])
}
