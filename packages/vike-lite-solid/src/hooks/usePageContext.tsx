import { useContext } from 'solid-js'
import type { PageContext } from 'vike-lite'
import { globalContext, type InternalContextValue } from '../shared/globalContext'
/**
 * Hook to access the full page context.
 * In SolidJS there is no need to omit `data` for performance reasons:
 * fine-grained reactivity ensures that components only update
 * if they access properties that have actually changed.
 * @link https://github.com/vikejs/vike-solid/blob/main/packages/vike-solid/hooks/usePageContext.tsx
 */
export function usePageContext<Data = unknown>(): PageContext<Data> {
  const ctx = useContext(globalContext.solidContext) as InternalContextValue<Data> | undefined
  if (!ctx) throw new Error('usePageContext() must be called inside a page rendered by vike-lite-solid')
  return ctx.state
}
