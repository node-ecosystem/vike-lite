export * from '../server/store'

interface HtmlShellParams {
  pageTitleTag: string
  cssLinks: string
  jsPreloads: string
  /** Statically rendered <head> content (not part of the hydrated tree). */
  headHtml: string
  /** Server-rendered app markup, or '' in Client Takeover mode. */
  appHtml: string
  serializedContext: string
  entryClient: string
  nonce?: string
  /**
   * Extra markup injected right after `headHtml`, before the context script.
   * Used by Solid for `generateHydrationScript()`.
   */
  extraHeadHtml?: string
}

/**
 * Renders the HTML document shell shared by every adapter: doctype, meta tags,
 * asset links, the injected `__PAGE_CONTEXT__` script, the root container and
 * the client entry script. Centralized so that CSP nonce handling (and any other
 * cross-cutting concern) is applied consistently instead of drifting between
 * React/Vue/Solid, as it did before this was factored out.
 */
export function renderHtmlShell({
  pageTitleTag,
  cssLinks,
  jsPreloads,
  headHtml,
  appHtml,
  serializedContext,
  entryClient,
  nonce,
  extraHeadHtml = ''
}: HtmlShellParams): string {
  const nonceAttr = nonce ? ` nonce="${nonce}"` : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${pageTitleTag}
${cssLinks}
${jsPreloads}
${headHtml}
${extraHeadHtml ? `${extraHeadHtml}\n` : ''}<script${nonceAttr}>window.__PAGE_CONTEXT__=${serializedContext}</script>
</head>
<body>
<div id="root" tabindex="-1">${appHtml}</div>
<script type="module" src="${entryClient}"${nonceAttr}></script>
</body>
</html>`
}
