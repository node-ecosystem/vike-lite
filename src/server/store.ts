import type { Config } from '../shared'
import type { Manifest } from '..'

const STORE_KEY = '_vike_lite'
const g = globalThis as any

if (!g[STORE_KEY]) {
  g[STORE_KEY] = {
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
  get: (_, prop) => g[STORE_KEY][prop as keyof VikeState],
  set: (_, prop, value) => {
    g[STORE_KEY][prop as keyof VikeState] = value
    return true
  }
})

export function setVikeState(newState: Partial<VikeState>) {
  Object.assign(g[STORE_KEY], newState)
}
