import { useContext } from 'solid-js'
import type { PageContext } from 'vike-lite'

import globalContext from './globalContext'
/**
 * @link https://github.com/vikejs/vike-solid/blob/main/packages/vike-solid/hooks/usePageContext.tsx
 * Hook to access the full page context.
 * In SolidJS there is no need to omit `data` for performance reasons:
 * fine-grained reactivity ensures that components only update
 * if they access properties that have actually changed.
 */
export default function usePageContext<Data = undefined>(): PageContext<Data> {
  return useContext(globalContext.solidContext)!.state
}
