import type { ComponentType, ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { renderHtmlShell } from 'vike-lite/__internal/server'
import type { RenderContext } from 'vike-lite/__internal/shared'

import { PageContextProvider } from '../shared/PageContextProvider'

interface ReactRenderContext extends RenderContext {
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
  assets: { cssLinks, jsPreloads, entryClient },
  hydration,
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

  const appHtml = hydration
    ? renderToString(
      <PageContextProvider value={providerValue}>
        {Layout ? <Layout><Page /></Layout> : <Page />}
      </PageContextProvider>
    )
    : ''  // Client Takeover: no server-side rendering of the app, only the shell

  return renderHtmlShell({ pageTitleTag, cssLinks, jsPreloads, headHtml, appHtml, serializedContext, entryClient, nonce })
}
