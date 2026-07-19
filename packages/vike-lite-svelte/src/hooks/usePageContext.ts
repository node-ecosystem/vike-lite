import { getContext } from 'svelte'
import type { PageContext } from 'vike-lite'
import { pageContextKey, type InternalContextValue } from '../shared/globalContext'

/**
 * Hook to access the full page context. Must be called during component
 * initialization (top level of a `<script>` block) — same constraint Svelte
 * imposes on `getContext` itself.
 */
export function usePageContext<Data = unknown>(): PageContext<Data> {
  const ctx = getContext(pageContextKey) as InternalContextValue<Data> | undefined
  if (!ctx) throw new Error('usePageContext() must be called inside a page rendered by vike-lite-svelte')
  return ctx.pageContext as PageContext<Data>
}
