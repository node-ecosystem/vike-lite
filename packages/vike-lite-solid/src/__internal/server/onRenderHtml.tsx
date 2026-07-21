import type { Component, ParentComponent } from 'solid-js'
import { renderToStringAsync, renderToStream, NoHydration, generateHydrationScript, renderToString } from 'solid-js/web'
import { Dynamic } from 'solid-js/web'
import { renderHtmlShell, renderHtmlShellStream } from 'vike-lite/__internal/server'
import type { RenderContext } from 'vike-lite/__internal/shared'

import { PageContextProvider } from '../shared/PageContextProvider'
import { RouterApp } from '../shared/RouterApp'

interface SolidRenderContext extends RenderContext {
  Page: Component
  Head?: Component
  Layout?: ParentComponent
  hydration: boolean
  /**
   * Stream the app markup via the Web Streams API (`ReadableStream`) instead of
   * buffering it into a single string before sending it. Ignored in Client
   * Takeover mode (`hydration: false`), since there's no server-rendered app
   * markup to stream in the first place.
   * @default false
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
}: SolidRenderContext) {
  const headHtml = Head ? renderToString(() => (
    <NoHydration>
      <PageContextProvider pageContext={pageContext} setPageContext={() => { }}>
        <Dynamic component={Head} />
      </PageContextProvider>
    </NoHydration>
  )) : ''

  const hydrationScript = hydration ? generateHydrationScript() : ''

  if (!hydration) {
    // Client Takeover: no server-side rendering of the app, only the shell
    return renderHtmlShell({ pageTitleTag, cssLinks, jsPreloads, headHtml, appHtml: '', serializedContext, entryClient, nonce })
  }

  const renderApp = () => (
    <RouterApp
      routes={[]}
      errorRoute={null}
      initialUrl={pageContext.urlOriginal}
      initialContext={pageContext}
      initialView={{ Page, Layout: Layout ?? null, Head: null }}
    />
  )

  if (streaming) {
    // solid-js/web's renderToStream() writes markup chunks as they resolve (e.g. past
    // <Suspense> boundaries). It exposes `pipeTo(writable: WritableStream)`, a standard
    // WHATWG Writable — piping it into a TransformStream gives us a plain `ReadableStream`
    // that reads identically on Node.js, Deno, Bun and Edge runtimes.
    const { readable, writable } = new TransformStream<string, string>()
    renderToStream(renderApp, { nonce }).pipeTo(writable).catch((error: unknown) => {
      // The shell has already started streaming to the client by this point,
      // so an error page can no longer be swapped in — just report it.
      console.error('[vike-lite-solid] Streaming render error:', error)
    })
    return renderHtmlShellStream({
      pageTitleTag, cssLinks, jsPreloads, headHtml, appStream: readable, serializedContext, entryClient, nonce,
      extraHeadHtml: hydrationScript
    })
  }

  const appHtml = await renderToStringAsync(renderApp)

  return renderHtmlShell({
    pageTitleTag, cssLinks, jsPreloads, headHtml, appHtml, serializedContext, entryClient, nonce,
    extraHeadHtml: hydrationScript
  })
}
