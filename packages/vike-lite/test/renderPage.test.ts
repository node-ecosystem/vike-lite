import { describe, it, beforeEach } from 'vitest'
import { strictEqual, ok } from 'node:assert/strict'

import { renderPage } from '../src/server/renderPage'
import { setVikeState } from '../src/server/store'
import type { RenderContext } from '../src/__internal/shared'

function makeRoute(overrides: Record<string, unknown> = {}) {
  return {
    path: '/',
    page: 'index',
    Page: async () => ({ default: () => null }),
    ...overrides
  }
}

describe('renderPage — server-side pageContext', () => {
  let capturedContexts: RenderContext['pageContext'][]

  beforeEach(() => {
    capturedContexts = []
    setVikeState({
      routes: [makeRoute()] as any,
      errorRoute: makeRoute({ path: undefined, page: 'error' }) as any,
      config: {
        onRenderClient: async () => ({ default: () => { } }),
        async onRenderHtml(ctx: RenderContext) {
          capturedContexts.push(ctx.pageContext)
          return '<html></html>'
        }
      } as any,
      manifest: null
    })
  })

  it('renders a matched page with isClientSide:false in the pageContext passed to onRenderHtml', async () => {
    const res = await renderPage(new Request('http://localhost/'))
    strictEqual(res.status, 200)
    strictEqual(capturedContexts.length, 1)
    strictEqual(capturedContexts[0].isClientSide, false)
  })

  it('renders the 404 error page with isClientSide:false in the pageContext passed to onRenderHtml', async () => {
    const res = await renderPage(new Request('http://localhost/does-not-exist'))
    strictEqual(res.status, 404)
    strictEqual(capturedContexts.length, 1)
    strictEqual(capturedContexts[0].isClientSide, false)
    strictEqual(capturedContexts[0].is404, true)
  })

  it('the .pageContext.json endpoint reports isClientSide:false for a matched page', async () => {
    const res = await renderPage(new Request('http://localhost/index.pageContext.json'))
    strictEqual(res.status, 200)
    const json = await res.json()
    strictEqual(json.isClientSide, false)
  })

  it('accepts and ignores extra platform-injected keys (e.g. Vercel-style { params })', async () => {
    // Regression: renderPage's options param was typed `{ [key: string]: any }`,
    // now `{ [key: string]: unknown }` — make sure passing extra keys still works at runtime.
    const res = await renderPage(new Request('http://localhost/'), { nonce: 'abc', params: { id: '1' } })
    strictEqual(res.status, 200)
    ok(res)
  })
})
