import type { Component, ParentComponent } from 'solid-js'
import { renderToStringAsync, NoHydration, generateHydrationScript, renderToString } from 'solid-js/web'
import { Dynamic } from 'solid-js/web'
import { renderHtmlShell } from 'vike-lite/__internal/server'
import type { RenderContext } from 'vike-lite/__internal/shared'

import { PageContextProvider } from '../shared/PageContextProvider'
import { RouterApp } from '../shared/RouterApp'

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
    <RouterApp
      routes={[]}
      errorRoute={null}
      initialUrl={pageContext.urlOriginal}
      initialContext={pageContext as any}
      initialView={{ Page, Layout: Layout ?? null, Head: null }}
    />
  )) : ''

  return renderHtmlShell({
    pageTitleTag, cssLinks, jsPreloads, headHtml, appHtml, serializedContext, entryClient, nonce,
    extraHeadHtml: hydrationScript
  })
}
