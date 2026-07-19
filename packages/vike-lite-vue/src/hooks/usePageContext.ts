import type { PageContext } from 'vike-lite'
import { inject } from 'vue'

import { pageContextInjectionKey } from '../shared/globalContext'

export function usePageContext(): PageContext {
  const ctx = inject(pageContextInjectionKey)
  if (!ctx) throw new Error('usePageContext() must be called inside a page rendered by vike-lite-vue')
  return ctx.pageContext
}
