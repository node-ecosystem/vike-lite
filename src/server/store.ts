import type { RenderContext } from '../shared'

export interface VikeState {
  routes: any[]
  errorRoute: any | null
  config: { onRenderHtml: () => Promise<{ default: (ctx: RenderContext) => Promise<string> }> } | null
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
