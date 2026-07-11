import { createContext } from 'solid-js'
import type { SetStoreFunction, Store } from 'solid-js/store'
import type { PageContext } from 'vike-lite'

const projectKey = '_vike_lite_solid'

function getGlobalObject<T extends object = never>(
  key: string,
  defaultValue: T
): T {
  // @ts-expect-error Property '_vike_lite_solid' does not exist on type 'typeof globalThis'
  const globalObjectsAll = globalThis[projectKey] ||= {}
  return globalObjectsAll[key] ||= defaultValue
}

// Raw store in the Context: contains the full PageContext.
export interface InternalContextValue<Data = unknown> {
  state: Store<PageContext<Data>>
  setState: SetStoreFunction<PageContext<Data>>
}

const globalContext = getGlobalObject('PageContextProvider', {
  solidContext: createContext<InternalContextValue<unknown>>()
})

export default globalContext
