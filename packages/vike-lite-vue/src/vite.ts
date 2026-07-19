import vuePlugin, { type Options as VueOptions } from '@vitejs/plugin-vue'
import { createFrameworkAdapterPlugin } from 'vike-lite/__internal/vite'
import { mergeConfig, type PluginOption } from 'vite'

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
    adapter
  ]
}
