import type { RenderContext } from 'vike-lite/__internal/shared'
import { createSSRApp, h, type Component } from 'vue'
import { renderToString } from 'vue/server-renderer'

import { pageContextInjectionKey } from '../../hooks/globalContext'

export interface VueRenderContext extends RenderContext {
  Page: Component
  Head?: Component
  Layout?: Component
}

export async function onRenderHtml({
  pageContext,
  Page,
  Head,
  Layout,
  pageTitleTag,
  serializedContext,
  assets
}: VueRenderContext) {
  const { cssLinks, jsPreloads, entryClient } = assets

  // Head: renderizzato separatamente, staticamente — non fa parte
  // dell'albero idratato dal client (stesso principio di Solid/React)
  let headHtml = ''
  if (Head) {
    const headApp = createSSRApp({ render: () => h(Head) })
    headApp.provide(pageContextInjectionKey, { pageContext })
    headHtml = await renderToString(headApp)
  }

  // App: struttura IDENTICA a quella che il client idraterà
  const app = createSSRApp({
    render: () => Layout
      ? h(Layout, null, { default: () => h(Page) })
      : h(Page)
  })
  app.provide(pageContextInjectionKey, { pageContext })
  const appHtml = await renderToString(app)

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${pageTitleTag}
${cssLinks}
${jsPreloads}
${headHtml}
<script>window.__PAGE_CONTEXT__=${serializedContext}</script>
</head>
<body>
<div id="root">${appHtml}</div>
<script type="module" src="${entryClient}"></script>
</body>
</html>`
}
