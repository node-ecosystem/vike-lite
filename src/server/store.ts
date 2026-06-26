import type { Config } from '../shared'

export interface VikeState {
  routes: any[]
  errorRoute: any | null
  config: Config | null
  manifest: Record<string, any> | undefined
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
