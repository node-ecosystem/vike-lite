import type { Plugin } from 'vite'

export default function vikeLiteSolid(): Plugin {
  const virtualRendererId = 'virtual:vike-lite/renderer'
  const resolvedVirtualRendererId = '\0' + virtualRendererId
  return {
    name: 'vike-lite-solid',
    // Execute this before vike-lite so the virtual module is ready
    enforce: 'pre',
    config() {
      return {
        // OptimizeDeps is for the Vite Dev Server
        optimizeDeps: {
          include: ['solid-js'],
          // Ensure Vite doesn't try to pre-bundle the whole package as standard JS,
          // allowing JSX/TSX to be processed correctly if imported directly.
          exclude: ['vike-lite-solid']
        },
        // SSR config is for the Server Build
        ssr: {
          // Tell Vite NOT to externalize this package.
          // This forces Vite to process our components through vite-plugin-solid
          // during the SSR build, otherwise Node.js will choke on raw JSX.
          noExternal: ['vike-lite-solid']
        }
      }
    },
    // Provide a virtual module that vike-lite will read to discover the renderers
    resolveId(id) {
      if (id === virtualRendererId) return resolvedVirtualRendererId
    },
    load(id) {
      if (id === resolvedVirtualRendererId) {
        // We use dynamic imports here. This is crucial because it allows Vite
        // to code-split the Node.js server logic from the Browser client logic!
        return `export const onRenderHtml=()=>import('vike-lite-solid/__internal/server/onRenderHtml');
          export const onRenderClient=()=>import('vike-lite-solid/__internal/client/onRenderClient');`
      }
    }
  }
}
