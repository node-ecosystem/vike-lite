const STORE_KEY = '_vike_lite'

if (!Object.hasOwn(globalThis, STORE_KEY)) {
  globalThis[STORE_KEY] = {
    routes: [],
    errorRoute: null,
    config: null,
    manifest: null
  } as VikeState
}

export interface VikeState {
  routes: typeof import('virtual:vike-lite/routes')['routes']
  errorRoute: typeof import('virtual:vike-lite/routes')['errorRoute'] | null
  config: typeof import('virtual:vike-lite/routes')['config'] | null
  manifest: typeof import('virtual:vike-lite/client-manifest')['default'] | null
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
