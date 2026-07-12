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

export default function vikeLiteReact(options: VikeLiteReactOptions = {}): Plugin[] {
  const { hydration = true, react: reactOptions } = options

  const virtualId = 'virtual:vike-lite/renderer'
  const resolvedVirtualId = '\0' + virtualId

  const adapter: Plugin = {
    name: 'vike-lite-react',
    enforce: 'pre',
    resolveId(id) {
      if (id === virtualId) return resolvedVirtualId
    },
    load(id) {
      if (id === resolvedVirtualId) {
        return `export const hydration = ${JSON.stringify(hydration)};`
          + `export const onRenderHtml = () => import('vike-lite-react/__internal/server/onRenderHtml');`
          + `export const onRenderClient = () => import('vike-lite-react/__internal/client/onRenderClient');`
      }
    }
  }

  return [...react(reactOptions), adapter]
}
