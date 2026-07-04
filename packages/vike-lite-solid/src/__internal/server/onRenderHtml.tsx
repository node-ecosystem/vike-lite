import { hydration } from 'virtual:vike-lite-solid/config'
import { renderToStringAsync, NoHydration, generateHydrationScript, renderToString } from 'solid-js/web'
import type { Component, ParentComponent } from 'solid-js'
import type { RenderContext } from 'vike-lite/__internal/shared'

import PageContextProvider from '../shared/PageContextProvider'
import RouterApp from '../shared/RouterApp'

export interface SolidRenderContext extends RenderContext {
  Page: Component
  Head?: Component
  Layout?: ParentComponent
}

export default async function onRenderHtml({
  pageContext, Page, Head, Layout, pageTitleTag, serializedContext, assets, nonce
}: SolidRenderContext) {
  const { cssLinks, jsPreloads, entryClient } = assets

  const headHtml = Head ? renderToString(() => (
    <NoHydration>
      <PageContextProvider pageContext={pageContext} setPageContext={() => { }}>
        <Head />
      </PageContextProvider>
    </NoHydration>
  )) : ''

  const hydrationScript = hydration ? generateHydrationScript() : ''

  const nonceAttr = nonce ? ` nonce="${nonce}"` : ''

  const appHtml = await renderToStringAsync(() => (
    <RouterApp
      routes={[]}
      errorRoute={null}
      initialUrl={pageContext.urlOriginal}
      initialContext={pageContext}
      initialView={{ Page, Layout: Layout ?? null, Head: null }}
    />
  ))

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${pageTitleTag}
${cssLinks}
${jsPreloads}
${headHtml}
${hydrationScript}
<script${nonceAttr}>window.__PAGE_CONTEXT__=${serializedContext}</script>
</head>
<body>
<div id="root" tabindex="-1">${appHtml}</div>
<script type="module" src="${entryClient}"></script>
</body>
</html>`
}
