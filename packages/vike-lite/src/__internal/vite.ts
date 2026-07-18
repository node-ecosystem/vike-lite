import type { Plugin } from 'vite'

/**
 * Creates the Vite plugin that configures dev-server pre-bundling and SSR externalization
 * for framework adapters (e.g. vike-lite-solid, vike-lite-vue) that export raw, uncompiled
 * source files (.tsx/.vue) instead of a pre-built dist. Those adapters need:
 *  - `optimizeDeps.include`: eagerly pre-bundle the framework runtime (e.g. `solid-js`, `vue`)
 *    so the dev server doesn't re-bundle it on every page navigation.
 *  - `optimizeDeps.exclude` + `ssr.noExternal`: prevent Vite from treating the adapter package
 *    as an opaque, externalizable dependency, so its raw JSX/SFC source is instead processed
 *    by the framework's own Vite plugin (e.g. vite-plugin-solid, @vitejs/plugin-vue) both in
 *    dev and during the SSR build.
 *
 * This centralizes logic that is otherwise identical across every `vike-lite-*` package
 * that ships raw source files.
 */
export function createDepsConfigPlugin({
  packageName,
  optimizeDepsInclude
}: {
  /** The framework adapter's package name, e.g. 'vike-lite-solid'. */
  packageName: string
  /** Framework runtime packages to eagerly pre-bundle, e.g. ['solid-js']. */
  optimizeDepsInclude: string[]
}): Plugin {
  return {
    name: `${packageName}-config`,
    // Execute this before vike-lite so the virtual module is ready
    enforce: 'pre',
    config() {
      return {
        // OptimizeDeps is for the Vite Dev Server
        optimizeDeps: {
          include: optimizeDepsInclude,
          // Ensure Vite doesn't try to pre-bundle the whole package as standard JS,
          // allowing JSX/SFC to be processed correctly if imported directly.
          exclude: [packageName]
        },
        // SSR config is for the Server Build
        ssr: {
          // Tell Vite NOT to externalize this package.
          // This forces Vite to process our components through the framework's plugin
          // during the SSR build, otherwise Node.js will choke on raw JSX/SFC syntax.
          noExternal: [packageName]
        }
      }
    }
  }
}

/**
 * Creates the Vite plugin that wires a UI framework adapter (react/vue/solid) into vike-lite,
 * by providing the virtual `virtual:vike-lite/client` and `virtual:vike-lite/server` modules
 * that vike-lite's core plugin reads to discover the framework's onRenderClient/onRenderHtml hooks.
 *
 * This centralizes logic that is otherwise identical across every `vike-lite-*` package.
 */
export function createFrameworkAdapterPlugin({
  packageName,
  hydration = true,
  // Some frameworks (e.g. Vue) decide hydration entirely on the client and don't
  // need the flag threaded through the server-rendered HTML.
  wrapServerHydration = true
}: {
  /** The framework adapter's package name, e.g. 'vike-lite-react'. */
  packageName: string
  /** @default true */
  hydration?: boolean
  /** @default true */
  wrapServerHydration?: boolean
}): Plugin {
  const virtualClientId = 'virtual:vike-lite/client'
  const virtualServerId = 'virtual:vike-lite/server'
  const resolvedVirtualClientId = '\0' + virtualClientId
  const resolvedVirtualServerId = '\0' + virtualServerId

  return {
    name: packageName,
    enforce: 'pre',
    resolveId(id) {
      if (id === virtualClientId) return resolvedVirtualClientId
      if (id === virtualServerId) return resolvedVirtualServerId
    },
    load(id) {
      if (id === resolvedVirtualClientId) {
        return `export const onRenderClient=async(options)=>(await import("${packageName}/__internal/client/onRenderClient")).onRenderClient({...options,hydration:${hydration}});`
      }
      if (id === resolvedVirtualServerId) {
        return wrapServerHydration
          ? `import { onRenderHtml as _onRenderHtml } from '${packageName}/__internal/server/onRenderHtml';`
          + `export const onRenderHtml = (ctx) => _onRenderHtml({ ...ctx, hydration: ${hydration} });`
          : `export{onRenderHtml}from'${packageName}/__internal/server/onRenderHtml';`
      }
    }
  }
}
