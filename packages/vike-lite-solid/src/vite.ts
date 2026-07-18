import { createDepsConfigPlugin, createFrameworkAdapterPlugin } from 'vike-lite/__internal/vite'
import { mergeConfig, type PluginOption } from 'vite'
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
  // Ensures Vite pre-bundles solid-js in dev and processes our raw .tsx source
  // through vite-plugin-solid instead of externalizing it during the SSR build
  const depsConfig = createDepsConfigPlugin({ packageName: 'vike-lite-solid', optimizeDepsInclude: ['solid-js'] })

  // Provide a virtual module that vike-lite will read to discover the renderers
  const adapter = createFrameworkAdapterPlugin({ packageName: 'vike-lite-solid', hydration })

  return [
    solidPlugin(mergeConfig(
      {
        ssr: true,
        typescript: { onlyRemoveTypeImports: true },
        solid: { hydratable: true }
      },
      solidUserOptions
    )),
    depsConfig,
    adapter
  ]
}
