import { renderToStringAsync, NoHydration, generateHydrationScript, renderToString } from 'solid-js/web'
import { Dynamic } from 'solid-js/web'
import type { Component, ParentComponent } from 'solid-js'
import { renderHtmlShell } from 'vike-lite/__internal/server'
import type { RenderContext } from 'vike-lite/__internal/shared'

import { PageContextProvider } from '../shared/PageContextProvider'
import { RootErrorBoundary } from '../shared/RootErrorBoundary'

interface SolidRenderContext extends RenderContext {
  Page: Component
  Head?: Component
  Layout?: ParentComponent
  hydration: boolean
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
  hydration
}: SolidRenderContext) {
  const headHtml = Head ? renderToString(() => (
    <NoHydration>
      <PageContextProvider pageContext={pageContext as any} setPageContext={() => { }}>
        <Dynamic component={Head} />
      </PageContextProvider>
    </NoHydration>
  )) : ''

  const hydrationScript = hydration ? generateHydrationScript() : ''

  const appHtml = hydration ? await renderToStringAsync(() => (
    <RootErrorBoundary>
      <PageContextProvider pageContext={pageContext as any} setPageContext={() => { }}>
        {Layout ? (
          <Dynamic component={Layout}>
            <Dynamic component={Page} />
          </Dynamic>
        ) : (
          <Dynamic component={Page} />
        )}
      </PageContextProvider>
    </RootErrorBoundary>
  )) : '' // Client Takeover: not rendering the appHTML

  return renderHtmlShell({
    pageTitleTag, cssLinks, jsPreloads, headHtml, appHtml, serializedContext, entryClient, nonce,
    extraHeadHtml: hydrationScript
  })
}
