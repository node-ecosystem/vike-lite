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
interface InternalContextValue {
  state: Store<PageContext>
  setState: SetStoreFunction<PageContext>
}

const globalContext = getGlobalObject('PageContextProvider', {
  solidContext: createContext<InternalContextValue>(undefined as never)
})

export default globalContext
