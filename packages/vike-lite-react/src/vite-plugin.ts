// src/vite-plugin.ts
import type { Plugin } from 'vite'
import react, { type Options as ReactPluginOptions } from '@vitejs/plugin-react'

export interface VikeLiteReactOptions {
  /**
   * Enable client hydration (SSR + hydrate) or full client takeover (SPA mode).
   * @default true
   */
  hydration?: boolean
  /**
   * Advanced: pass options directly to the underlying @vitejs/plugin-react.
   */
  react?: ReactPluginOptions
}

export default function vikeLiteReact({ hydration = true, react: reactOptions }: VikeLiteReactOptions = {}): Plugin[] {
  const virtualConfigId = 'virtual:vike-lite/config'
  const virtualRendererId = 'virtual:vike-lite/renderer'
  const resolvedVirtualConfigId = '\0' + virtualConfigId
  const resolvedVirtualRendererId = '\0' + virtualRendererId

  const adapter: Plugin = {
    name: 'vike-lite-react',
    enforce: 'pre',
    resolveId(id) {
      if (id === virtualConfigId) return resolvedVirtualConfigId
      if (id === virtualRendererId) return resolvedVirtualRendererId
    },
    load(id) {
      if (id === resolvedVirtualConfigId) {
        return `export const hydration = ${JSON.stringify(hydration)};`
      }
      if (id === resolvedVirtualRendererId) {
        return `export const onRenderHtml = () => import('vike-lite-react/__internal/server/onRenderHtml');`
          + `export const onRenderClient = () => import('vike-lite-react/__internal/client/onRenderClient');`
      }
    }
  }

  return [...react(reactOptions), adapter]
}
