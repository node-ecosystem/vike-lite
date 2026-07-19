import { renderHtmlShell } from 'vike-lite/__internal/server'
import type { RenderContext } from 'vike-lite/__internal/shared'
import { createSSRApp, h, type Component } from 'vue'
import { renderToString } from 'vue/server-renderer'

import { pageContextInjectionKey } from '../../shared/globalContext'

interface VueRenderContext extends RenderContext {
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
  assets: { cssLinks, jsPreloads, entryClient },
  nonce
}: VueRenderContext) {
  let headHtml = ''
  if (Head) {
    const headApp = createSSRApp({ render: () => h(Head) })
    headApp.provide(pageContextInjectionKey, { pageContext })
    headHtml = await renderToString(headApp)
  }

  const app = createSSRApp({
    render: () => Layout
      ? h(Layout, null, { default: () => h(Page) })
      : h(Page)
  })
  app.provide(pageContextInjectionKey, { pageContext })
  const appHtml = await renderToString(app)

  return renderHtmlShell({ pageTitleTag, cssLinks, jsPreloads, headHtml, appHtml, serializedContext, entryClient, nonce })
}
