import type { Plugin } from 'vite'

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
