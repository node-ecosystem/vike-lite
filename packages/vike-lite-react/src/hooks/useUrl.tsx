import { useMemo } from 'react'
import { usePageContext } from './usePageContext'

export function useUrl(): URL {
  const pageContext = usePageContext()
  return useMemo(() => new URL(pageContext.urlOriginal), [pageContext.urlOriginal])
}
