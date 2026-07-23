import { render } from 'svelte/server'
import type { Component } from 'svelte'
import type { RenderContext } from 'vike-lite/__internal/shared'
import { renderHtmlShell } from 'vike-lite/__internal/server'

import PageShell from './PageShell.svelte'

export interface SvelteRenderContext extends RenderContext {
  Page: Component
  Head?: Component
  Layout?: Component
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
}: SvelteRenderContext) {
  // Head: rendered separately, statically — not part of the tree that gets
  // hydrated client-side (same principle applied by React/Solid)
  let headHtml = ''
  if (Head) {
    const result = await render(PageShell, { props: { pageContext, Content: Head } })
    headHtml = result.html
  }

  let appHtml = ''
  let svelteAutoHead = ''
  if (hydration) {
    // App: SAME structure the client will hydrate
    const result = await render(PageShell, { props: { pageContext, Content: Page, Layout } })
    appHtml = result.html
    // Anything a page pushed via Svelte's native <svelte:head> (distinct from
    // vike-lite's own +Head.svelte convention) — captured here as a bonus, since
    // it's the "main" render pass where such usage is most likely.
    svelteAutoHead = result.head
  } // Client Takeover: no server-side rendering of the app, only the shell

  return renderHtmlShell({
    pageTitleTag,
    cssLinks,
    jsPreloads,
    headHtml: headHtml + svelteAutoHead,
    appHtml,
    serializedContext,
    entryClient,
    nonce
  })
}
