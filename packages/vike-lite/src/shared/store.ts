export interface VikeState {
  routes: typeof import('virtual:vike-lite/routes')['routes'] | []
  errorRoute: typeof import('virtual:vike-lite/routes')['errorRoute'] | null
  config: typeof import('virtual:vike-lite/routes')['config'] | null
  manifest: typeof import('virtual:vike-lite/client-manifest')['default'] | null
}

const KEY = Symbol.for('vike-lite:store')

export const store: VikeState = (globalThis as { [KEY]?: VikeState })[KEY] ??= {
  routes: [],
  errorRoute: null,
  config: null,
  manifest: null
}

export function setVikeState(newState: Partial<VikeState>) {
  Object.assign(store, newState)
}
