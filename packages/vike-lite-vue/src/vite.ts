import vuePlugin, { type Options as VueOptions } from '@vitejs/plugin-vue'
import { mergeConfig, type Plugin, type PluginOption } from 'vite'

export default function vikeLiteVue({
  hydration = true,
  vue: vueUserOptions = {}
}: {
  /**
   * true: enable Vue Hydration (better UX)
   * false: destroy the SSR DOM and recreate the app (Client Takeover, no hydration mismatch)
   * @default true
   */
  hydration?: boolean
  /**
   * Advanced options passed directly to @vitejs/plugin-vue
   */
  vue?: Partial<VueOptions>
} = {}): PluginOption[] {
  const virtualClientId = 'virtual:vike-lite/client'
  const virtualServerId = 'virtual:vike-lite/server'
  const resolvedVirtualClientId = '\0' + virtualClientId
  const resolvedVirtualServerId = '\0' + virtualServerId

  const vikeLiteVuePlugin = {
    name: 'vike-lite-vue',
    enforce: 'pre',
    config() {
      return {
        optimizeDeps: {
          include: ['vue'],
          // Prevent Vite from pre-bundling the entire package as standard JS,
          // so that .vue/.tsx files are processed correctly if imported directly
          exclude: ['vike-lite-vue']
        },
        ssr: {
          // Force Vite to process this package through @vitejs/plugin-vue
          // during the SSR build, instead of externalizing it
          noExternal: ['vike-lite-vue']
        }
      }
    },
    resolveId(id) {
      if (id === virtualClientId) return resolvedVirtualClientId
      if (id === virtualServerId) return resolvedVirtualServerId
    },
    load(id) {
      if (id === resolvedVirtualClientId) {
        return 'export const onRenderClient = async () => {'
          + 'const mod = await import("vike-lite-vue/__internal/client/onRenderClient");'
          + `return (options) => mod.default({ ...options, hydration: ${hydration} });`
          + '}'
      }
      if (id === resolvedVirtualServerId) {
        return `export{onRenderHtml}from'vike-lite-vue/__internal/server/onRenderHtml';`
      }
    }
  } satisfies Plugin

  return [
    vuePlugin(mergeConfig(
      { ssr: true },
      vueUserOptions
    )),
    vikeLiteVuePlugin
  ]
}
