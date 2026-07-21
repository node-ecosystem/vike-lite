import type { ComponentType, ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
// `react-dom/server.edge` is the runtime-agnostic entry point: it only relies on
// standard Web Streams APIs (`ReadableStream`, `TextEncoder`), so `renderToReadableStream`
// streams identically on Node.js (18+), Deno, Bun and Edge runtimes (Cloudflare Workers,
// Vercel Edge, etc.) — unlike `react-dom/server.node`'s `renderToPipeableStream`, which is
// Node-only.
import { renderToReadableStream } from 'react-dom/server.edge'
import { renderHtmlShell, renderHtmlShellStream } from 'vike-lite/__internal/server'
import type { RenderContext } from 'vike-lite/__internal/shared'

import { PageContextProvider } from '../shared/PageContextProvider'

interface ReactRenderContext extends RenderContext {
  Page: ComponentType
  Head?: ComponentType
  Layout?: ComponentType<{ children: ReactNode }>
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
  hydration,
  streaming,
  nonce
}: ReactRenderContext) {
  const providerValue = { pageContext, setPageContext: () => { } }

  const headHtml = Head
    ? renderToString(
      <PageContextProvider value={providerValue}>
        <Head />
      </PageContextProvider>
    )
    : ''

  if (!hydration) {
    // Client Takeover: no server-side rendering of the app, only the shell
    return renderHtmlShell({ pageTitleTag, cssLinks, jsPreloads, headHtml, appHtml: '', serializedContext, entryClient, nonce })
  }

  const app = (
    <PageContextProvider value={providerValue}>
      {Layout ? <Layout><Page /></Layout> : <Page />}
    </PageContextProvider>
  )

  if (streaming) {
    // Resolves once the shell is ready to flush (mirrors onShellReady of the Node
    // pipeable-stream API); rejects on a shell-level error so the caller's existing
    // try/catch can still fall back to the error page before anything was sent.
    const appStream = await renderToReadableStream(app, {
      nonce,
      onError(error) {
        // The shell has already started streaming to the client by this point,
        // so an error page can no longer be swapped in — just report it.
        console.error('[vike-lite-react] Streaming render error:', error)
      }
    })
    return renderHtmlShellStream({ pageTitleTag, cssLinks, jsPreloads, headHtml, appStream, serializedContext, entryClient, nonce })
  }

  const appHtml = renderToString(app)
  return renderHtmlShell({ pageTitleTag, cssLinks, jsPreloads, headHtml, appHtml, serializedContext, entryClient, nonce })
}
