import { useContext } from 'solid-js'
import type { SetStoreFunction } from 'solid-js/store'
import type { PageContext } from 'vike-lite'

import { globalContext } from '../shared/globalContext'

/**
 * Hook dedicated to `data` for convenience (returns getter and setter as an array).
 * @link https://github.com/vikejs/vike-solid/blob/main/packages/vike-solid/hooks/useData.tsx
 */
export function useData<Data extends PageContext['data']>(): [Data, SetStoreFunction<Data>] {
  const context = useContext(globalContext.solidContext)!

  const setData: SetStoreFunction<Data> = (...args: any[]) => {
    // @ts-expect-error - pass args directly to 'data'
    context.setState('data', ...args)
  }

  return [context.state.data as Data, setData]
}
