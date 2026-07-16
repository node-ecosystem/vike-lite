import { mergeConfig, type Plugin, type PluginOption } from 'vite'
import solidPlugin, { type Options as SolidOptions } from 'vite-plugin-solid'

export default function vikeLiteSolid({
  hydration = true,
  solid: solidUserOptions = {}
}: {
  /** 
   * true: use hydration of SolidJS (better UX)
   * false: destroys the SSR DOM and recreates the app (Client Takeover, no hydration mismatch)
   * @default true
   */
  hydration?: boolean
  /** 
   * Advanced options passed directly to vite-plugin-solid 
   */
  solid?: Partial<SolidOptions>
} = {}): PluginOption[] {
  const virtualClientId = 'virtual:vike-lite/client'
  const virtualServerId = 'virtual:vike-lite/server'
  const resolvedVirtualClientId = '\0' + virtualClientId
  const resolvedVirtualServerId = '\0' + virtualServerId

  const vikeLiteSolidPlugin = {
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
      if (id === virtualClientId) return resolvedVirtualClientId
      if (id === virtualServerId) return resolvedVirtualServerId
    },
    load(id) {
      if (id === resolvedVirtualClientId) {
        return 'export const onRenderClient = async () => {'
          + 'const mod = await import("vike-lite-solid/__internal/client/onRenderClient");'
          + 'return (options) => mod.default({ ...options, hydration: ${hydration} });'
          + '}'
      }
      if (id === resolvedVirtualServerId) {
        return `import { onRenderHtml as _onRenderHtml } from 'vike-lite-solid/__internal/server/onRenderHtml';`
          + `export const onRenderHtml = (ctx) => _onRenderHtml({ ...ctx, hydration: ${hydration} });`
      }
    }
  } satisfies Plugin

  return [
    solidPlugin(mergeConfig(
      {
        ssr: true,
        typescript: { onlyRemoveTypeImports: true },
        solid: { hydratable: true }
      },
      solidUserOptions
    )),
    vikeLiteSolidPlugin
  ]
}
