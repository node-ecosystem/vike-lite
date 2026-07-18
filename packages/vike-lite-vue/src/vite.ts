import vuePlugin, { type Options as VueOptions } from '@vitejs/plugin-vue'
import { createFrameworkAdapterPlugin } from 'vike-lite/__internal/vite'
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
  const vikeLiteVuePlugin: Plugin = {
    name: 'vike-lite-vue-config',
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
    }
  }

  const adapter = createFrameworkAdapterPlugin({
    packageName: 'vike-lite-vue',
    hydration,
    // Vue's onRenderHtml doesn't need the hydration flag: hydration vs. client
    // takeover is decided entirely client-side in onRenderClient.
    wrapServerHydration: false
  })

  return [
    vuePlugin(mergeConfig(
      { ssr: true },
      vueUserOptions
    )),
    vikeLiteVuePlugin,
    adapter
  ]
}
