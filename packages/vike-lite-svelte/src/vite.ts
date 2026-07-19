import { createDepsConfigPlugin, createFrameworkAdapterPlugin } from 'vike-lite/__internal/vite'
import { mergeConfig, type PluginOption } from 'vite'
import { svelte, type Options as SvelteOptions } from '@sveltejs/vite-plugin-svelte'

export default function vikeLiteSvelte({
  hydration = true,
  svelte: svelteUserOptions = {}
}: {
  /**
   * true: use hydration of Svelte (better UX)
   * false: destroys the SSR DOM and recreates the app (Client Takeover, no hydration mismatch)
   * @default true
   */
  hydration?: boolean
  /**
   * Advanced options passed directly to @sveltejs/vite-plugin-svelte
   */
  svelte?: Partial<SvelteOptions>
} = {}): PluginOption[] {
  // Ensures Vite pre-bundles svelte in dev and processes our raw .svelte/.ts source
  // through @sveltejs/vite-plugin-svelte instead of externalizing it during the SSR build.
  // Necessary here (unlike vike-lite-vue): like Solid, Svelte compiles JSX-like markup into
  // imperative code tied to the exact svelte runtime instance used to compile it, so the
  // consuming app must recompile vike-lite-svelte's raw source with its own Svelte version
  // rather than receiving a pre-built dist.
  const depsConfig = createDepsConfigPlugin({ packageName: 'vike-lite-svelte', optimizeDepsInclude: ['svelte'] })

  // Provide a virtual module that vike-lite will read to discover the renderers
  const adapter = createFrameworkAdapterPlugin({ packageName: 'vike-lite-svelte', hydration })

  return [
    svelte(mergeConfig(
      {
        // .svelte.ts modules (used for rune-based helpers like useUrl) must also be
        // compiled by the Svelte plugin, not just .svelte components
        extensions: ['.svelte', '.svelte.ts'],
        compilerOptions: { hydratable: true }
      },
      svelteUserOptions
    )),
    depsConfig,
    adapter
  ]
}
