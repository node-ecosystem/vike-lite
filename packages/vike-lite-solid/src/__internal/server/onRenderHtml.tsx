import { renderToStringAsync, NoHydration, generateHydrationScript, renderToString } from 'solid-js/web'
import { Dynamic } from 'solid-js/web'
import type { Component, ParentComponent } from 'solid-js'
import type { RenderContext } from 'vike-lite/__internal/shared'

import { PageContextProvider } from '../shared/PageContextProvider'

export interface SolidRenderContext extends RenderContext {
  Page: Component
  Head?: Component
  Layout?: ParentComponent
  hydration: boolean
}

export async function onRenderHtml({
  pageContext, Page, Head, Layout, pageTitleTag, serializedContext, assets, nonce, hydration
}: SolidRenderContext) {
  const { cssLinks, jsPreloads, entryClient } = assets

  const headHtml = Head ? renderToString(() => (
    <NoHydration>
      <PageContextProvider pageContext={pageContext as any} setPageContext={() => { }}>
        <Dynamic component={Head} />
      </PageContextProvider>
    </NoHydration>
  )) : ''

  const hydrationScript = hydration ? generateHydrationScript() : ''

  const nonceAttr = nonce ? ` nonce="${nonce}"` : ''

  const appHtml = hydration ? await renderToStringAsync(() => (
    <PageContextProvider pageContext={pageContext as any} setPageContext={() => { }}>
      {Layout ? (
        <Dynamic component={Layout}>
          <Dynamic component={Page} />
        </Dynamic>
      ) : (
        <Dynamic component={Page} />
      )}
    </PageContextProvider>
  )) : '' // Client Takeover: not rendering the appHTML

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
