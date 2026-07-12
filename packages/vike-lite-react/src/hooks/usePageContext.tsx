import { useContext } from 'react'
import type { PageContext } from 'vike-lite'

import { PageContextReactContext } from './globalContext'

export function usePageContext(): PageContext {
  const ctx = useContext(PageContextReactContext)
  if (!ctx) throw new Error('usePageContext() must be called inside a page rendered by vike-lite-react')
  return ctx.pageContext
}
