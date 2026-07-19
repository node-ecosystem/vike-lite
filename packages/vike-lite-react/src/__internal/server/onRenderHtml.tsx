import type { ComponentType, ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import type { RenderContext } from 'vike-lite/__internal/shared'

import { PageContextProvider } from '../shared/PageContextProvider'

export interface ReactRenderContext extends RenderContext {
  Page: ComponentType
  Head?: ComponentType
  Layout?: ComponentType<{ children: ReactNode }>
  hydration: boolean
}

export function onRenderHtml({
  pageContext,
  Page,
  Head,
  Layout,
  pageTitleTag,
  serializedContext,
  assets,
  hydration,
  nonce
}: ReactRenderContext) {
  const { cssLinks, jsPreloads, entryClient } = assets
  const nonceAttr = nonce ? ` nonce="${nonce}"` : ''

  const providerValue = { pageContext, setPageContext: () => { } }

  const headHtml = Head ? renderToString(
    <PageContextProvider value={providerValue}>
      <Head />
    </PageContextProvider>
  ) : ''

  const appHtml = hydration ? renderToString(
    <PageContextProvider value={providerValue}>
      {Layout ? <Layout><Page /></Layout> : <Page />}
    </PageContextProvider>
  ) : ''  // Client Takeover: no server-side rendering of the app, only the shell

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${pageTitleTag}
${cssLinks}
${jsPreloads}
${headHtml}
<script${nonceAttr}>window.__PAGE_CONTEXT__=${serializedContext}</script>
</head>
<body>
<div id="root" tabindex="-1">${appHtml}</div>
<script type="module" src="${entryClient}"${nonceAttr}></script>
</body>
</html>`
}
