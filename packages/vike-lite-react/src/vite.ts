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
  const virtualClientId = 'virtual:vike-lite/client'
  const virtualServerId = 'virtual:vike-lite/server'
  const resolvedVirtualClientId = '\0' + virtualClientId
  const resolvedVirtualServerId = '\0' + virtualServerId

  const adapter: Plugin = {
    name: 'vike-lite-react',
    enforce: 'pre',
    resolveId(id) {
      if (id === virtualClientId) return resolvedVirtualClientId
      if (id === virtualServerId) return resolvedVirtualServerId
    },
    load(id) {
      if (id === resolvedVirtualClientId) {
        return `export const onRenderClient=async(options)=>(await import("vike-lite-react/__internal/client/onRenderClient")).onRenderClient({...options,hydration:${hydration}});`
      }
      if (id === resolvedVirtualServerId) {
        return `import { onRenderHtml as _onRenderHtml } from 'vike-lite-react/__internal/server/onRenderHtml';`
          + `export const onRenderHtml = (ctx) => _onRenderHtml({ ...ctx, hydration: ${hydration} });`
      }
    }
  }

  return [...react(reactOptions), adapter]
}
