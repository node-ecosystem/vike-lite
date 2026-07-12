import type { ViteDevServer } from 'vite'

/**
 * Anti-FOUC: Inspect all known SSR modules, ask the client environment
 * to translate them into plain text (thanks to ?direct) and return them.
 */
export async function injectFOUCStyles(server: ViteDevServer, html: string): Promise<string> {
  const styles = new Set<string>()
  const ssrEnv = server.environments.ssr
  const clientEnv = server.environments.client

  // Instead of navigating the tree (which fails with dynamic import()),
  // we iterate over all known modules in the graph and filter the CSS.
  for (const mod of ssrEnv.moduleGraph.idToModuleMap.values()) {
    if (!(mod.file && /\.(css|scss|sass|less|styl|stylus)($|\?)/.test(mod.file))) continue
    const url = mod.url.split('?', 1)[0] + '?direct'
    try {
      const result = await clientEnv.transformRequest(url)
      if (result?.code) styles.add(result.code)
    } catch {
      // Skip interruptions to avoid breaking during dev-typing
    }
  }

  // If there's no CSS, return the HTML as is
  if (styles.size === 0) return html

  // Merge all CSS
  const cssContent = [...styles].join('')
  const headEndIndex = html.lastIndexOf('</head>')

  // Safety check: if for some reason there's no </head>, don't break anything
  if (headEndIndex === -1) return html

  // Inject the style block before the closing </head>
  return `${html.slice(0, headEndIndex)}<style type="text/css" data-vite-dev-fouc>${cssContent}</style>${html.slice(headEndIndex)}`
}
