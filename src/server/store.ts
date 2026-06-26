import type { Config } from '../shared'
import type { Manifest } from '..'

export interface VikeState {
  routes: any[]
  errorRoute: any | null
  config: Config | null
  manifest: Manifest | undefined
}

export const store: VikeState = {
  routes: [],
  errorRoute: null,
  config: null,
  manifest: undefined,
}

export function setVikeState(newState: Partial<VikeState>) {
  Object.assign(store, newState)
}
