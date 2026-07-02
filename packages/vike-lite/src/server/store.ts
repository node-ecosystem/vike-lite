import type { Config } from '../__internal/shared'

const STORE_KEY = '_vike_lite'

if (!Object.hasOwn(globalThis, STORE_KEY)) {
  // eslint-disable-next-line unicorn/no-global-object-property-assignment
  globalThis[STORE_KEY] = {
    routes: [],
    errorRoute: null,
    config: null,
    manifest: undefined
  } as VikeState
}

export interface VikeState {
  routes: any[]
  errorRoute: any | null
  config: Config | null
  manifest: Manifest | undefined
}

// Proxy that always reads from globalThis — works even if there are
// multiple instances of the module (node_modules vs Module Runner source in dev)
export const store = new Proxy({} as VikeState, {
  get: (_, prop) => globalThis[STORE_KEY][prop as keyof VikeState],
  set: (_, prop, value) => {
    globalThis[STORE_KEY][prop as keyof VikeState] = value
    return true
  }
})

export function setVikeState(newState: Partial<VikeState>) {
  Object.assign(globalThis[STORE_KEY], newState)
}
