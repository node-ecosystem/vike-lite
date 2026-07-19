import { createContext, type Context } from 'solid-js'
import type { SetStoreFunction, Store } from 'solid-js/store'
import type { PageContext } from 'vike-lite'

export interface InternalContextValue<Data = unknown> {
  state: Store<PageContext<Data>>
  setState: SetStoreFunction<PageContext<Data>>
}

const KEY = Symbol.for('vike-lite-solid:context')

type GlobalContext = { solidContext: Context<InternalContextValue<unknown> | undefined> }

export const globalContext: GlobalContext =
  (globalThis as { [KEY]?: GlobalContext | undefined })[KEY] ??= { solidContext: createContext<InternalContextValue<unknown>>() }
