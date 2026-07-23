import { renderHtmlShell, renderHtmlShellStream } from 'vike-lite/__internal/server'
import type { RenderContext } from 'vike-lite/__internal/shared'
import { createSSRApp, h, type Component } from 'vue'
import { renderToString, renderToWebStream } from 'vue/server-renderer'

import { pageContextInjectionKey } from '../../shared/globalContext'

interface VueRenderContext extends RenderContext {
  Page: Component
  Head?: Component
  Layout?: Component
  /**
    * Enable client hydration (SSR + hydrate) or full client takeover (SPA mode).
    * @default true
    */
  hydration?: boolean
  /**
   * Stream the app markup via the Web Streams API (`ReadableStream`) instead of
   * buffering it into a single string before sending it.
   * @default true
   */
  streaming?: boolean
}

export async function onRenderHtml({
  pageContext,
  Page,
  Head,
  Layout,
  pageTitleTag,
  serializedContext,
  assets: { cssLinks, jsPreloads, entryClient },
  nonce,
  hydration,
  streaming
}: VueRenderContext) {
  let headHtml = ''
  if (Head) {
    const headApp = createSSRApp({ render: () => h(Head) })
    headApp.provide(pageContextInjectionKey, { pageContext })
    headHtml = await renderToString(headApp)
  }

  // Client Takeover (hydration: false): skip rendering Page/Layout server-side —
  // the client discards this HTML anyway and mounts a fresh tree in onRenderClient.
  if (!hydration)
    return renderHtmlShell({ pageTitleTag, cssLinks, jsPreloads, headHtml, appHtml: '', serializedContext, entryClient, nonce })

  const app = createSSRApp({
    render: () => Layout
      ? h(Layout, null, { default: () => h(Page) })
      : h(Page)
  })
  app.provide(pageContextInjectionKey, { pageContext })

  if (streaming) {
    // `renderToWebStream` relies only on the standard Web Streams API (`ReadableStream`),
    // so it streams identically on Node.js, Deno, Bun and Edge runtimes.
    const appStream = renderToWebStream(app)
    return renderHtmlShellStream({ pageTitleTag, cssLinks, jsPreloads, headHtml, appStream, serializedContext, entryClient, nonce })
  }

  const appHtml = await renderToString(app)
  return renderHtmlShell({ pageTitleTag, cssLinks, jsPreloads, headHtml, appHtml, serializedContext, entryClient, nonce })
}
