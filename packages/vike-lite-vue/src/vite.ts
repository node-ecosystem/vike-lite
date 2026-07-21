import vuePlugin, { type Options as VueOptions } from '@vitejs/plugin-vue'
import { createFrameworkAdapterPlugin } from 'vike-lite/__internal/vite'
import { mergeConfig, type PluginOption } from 'vite'

export default function vikeLiteVue({
  hydration = true,
  streaming = false,
  vue: vueUserOptions = {}
}: {
  /**
   * true: enable Vue Hydration (better UX)
   * false: destroy the SSR DOM and recreate the app (Client Takeover, no hydration mismatch)
   * @default true
   */
  hydration?: boolean
  /**
   * Stream the server-rendered app markup via the Web Streams API (`ReadableStream`)
   * instead of buffering it into a single string before sending the response.
   * Uses `@vue/server-renderer`'s `renderToWebStream`, so it works the same way
   * on Node.js, Deno, Bun and Edge runtimes.
   * @default false
   */
  streaming?: boolean
  /**
   * Advanced options passed directly to @vitejs/plugin-vue
   */
  vue?: Partial<VueOptions>
} = {}): PluginOption[] {
  const adapter = createFrameworkAdapterPlugin({
    packageName: 'vike-lite-vue',
    hydration,
    streaming,
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
