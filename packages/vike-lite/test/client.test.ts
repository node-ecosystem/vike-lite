import { describe, it } from 'vitest'
import { strictEqual, deepStrictEqual, ok, rejects } from 'node:assert/strict'

import { buildInitialClientContext, buildNavigationPageContext, createRoutePrefetcher, buildPageContextJsonUrl, loadViewModules, fetchPageContextJson, resolveHydrationView } from '../src/__internal/client'

describe('vike-lite client utils', () => {
  describe('buildPageContextJsonUrl', () => {
    it('should build index page context URL', () => {
      // Note: BASE_URL might be undefined/empty depending on env setup without Vite runtime, assuming empty
      const url = buildPageContextJsonUrl('/', '?id=1')
      strictEqual(url.includes('/index.pageContext.json?id=1'), true)
    })

    it('should build arbitrary page context URL', () => {
      const url = buildPageContextJsonUrl('/about', '')
      strictEqual(url.includes('/about.pageContext.json'), true)
    })
  })

  describe('createRoutePrefetcher', () => {
    it('should fetch provided modules exactly once', async () => {
      const prefetcher = createRoutePrefetcher()
      let count = 0
      const dummyRoute = {
        page: 'fake-page',
        Page: async () => {
          count++
          return { default: () => null }
        }
      }

      prefetcher(dummyRoute)
      // Sync synchronous call will schedule promise
      await new Promise(r => setTimeout(r, 0))
      strictEqual(count, 1)

      // Second call with same id should be ignored
      prefetcher(dummyRoute)
      await new Promise(r => setTimeout(r, 0))
      strictEqual(count, 1)
    })
  })

  describe('loadViewModules', () => {
    it('prefers the named export over the default export', async () => {
      const PageNamed = () => 'page-named'
      const PageDefault = () => 'page-default'
      const view = await loadViewModules({
        Page: async () => ({ Page: PageNamed, default: PageDefault })
      })
      strictEqual(view.Page, PageNamed)
    })

    it('falls back to the default export when no named export is present', async () => {
      const PageDefault = () => 'page-default'
      const view = await loadViewModules({
        Page: async () => ({ default: PageDefault })
      })
      strictEqual(view.Page, PageDefault)
    })

    it('resolves Layout/Head to null when the route has no loader for them', async () => {
      const view = await loadViewModules({
        Page: async () => ({ default: () => null })
      })
      strictEqual(view.Layout, null)
      strictEqual(view.Head, null)
    })

    it('resolves Layout/Head to null when their loader resolves to an empty module', async () => {
      const view = await loadViewModules({
        Page: async () => ({ default: () => null }),
        Layout: async () => ({}),
        Head: async () => ({})
      })
      strictEqual(view.Layout, null)
      strictEqual(view.Head, null)
    })

    it('loads Page/Layout/Head in parallel, not sequentially', async () => {
      const order: string[] = []
      await loadViewModules({
        Page: async () => { order.push('page-start'); await new Promise(r => setTimeout(r, 10)); order.push('page-end'); return { default: () => null } },
        Layout: async () => { order.push('layout-start'); return { default: () => null } },
        Head: async () => { order.push('head-start'); return { default: () => null } }
      })
      // All three loaders should have started before the slow Page loader finished
      ok(order.indexOf('page-end') === order.length - 1, `expected page-end last, got: ${order.join(',')}`)
    })
  })

  describe('fetchPageContextJson', () => {
    it('parses and returns a JSON response', async () => {
      const originalFetch = globalThis.fetch
      globalThis.fetch = (async () => new Response(JSON.stringify({ title: 'Hello' }), {
        headers: { 'content-type': 'application/json' }
      })) as typeof fetch
      try {
        const controller = new AbortController()
        const result = await fetchPageContextJson('/about.pageContext.json', { signal: controller.signal })
        deepStrictEqual(result, { title: 'Hello' })
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    it('throws a descriptive error when a proxy/CDN returns non-JSON', async () => {
      const originalFetch = globalThis.fetch
      globalThis.fetch = (async () => new Response('<html>Not Found</html>', {
        headers: { 'content-type': 'text/html' }
      })) as typeof fetch
      try {
        const controller = new AbortController()
        await rejects(
          () => fetchPageContextJson('/about.pageContext.json', { signal: controller.signal }),
          /Expected JSON but got "text\/html"/
        )
      } finally {
        globalThis.fetch = originalFetch
      }
    })
  })

  describe('buildInitialClientContext', () => {
    it('stamps isClientSide:true and the given isHydration flag onto the raw context', () => {
      const raw = { urlPathname: '/about', routeParams: {} }
      const result = buildInitialClientContext(raw, true)
      strictEqual(result.isClientSide, true)
      strictEqual(result.isHydration, true)
      strictEqual(result.urlPathname, '/about')
    })

    it('defaults to an empty object when rawContext is undefined', () => {
      const result = buildInitialClientContext(undefined, false)
      strictEqual(result.isClientSide, true)
      strictEqual(result.isHydration, false)
    })
  })

  describe('buildNavigationPageContext', () => {
    // Regression test: the Solid, Vue, and Svelte adapters each construct a fresh
    // pageContext object on every successful client-side navigation. Three of the
    // four adapters independently forgot to include isClientSide/isHydration in
    // that fresh object — and because their reactive store-update helpers
    // replace/prune the previous state, this silently *deleted* those flags from
    // pageContext after every navigation. This helper centralizes construction so
    // that bug class can't reoccur: no adapter can build a "next" pageContext
    // without these flags being set correctly.
    it('always stamps isClientSide:true and isHydration:false', () => {
      const result = buildNavigationPageContext({ urlPathname: '/about', routeParams: {} })
      strictEqual(result.isClientSide, true)
      strictEqual(result.isHydration, false)
    })

    it('cannot have isClientSide/isHydration overridden by the caller-supplied fields', () => {
      // Even if a caller's spread accidentally includes these keys (e.g. from a
      // stale ...contextOverride), the navigation flags set by this helper win,
      // since they're applied last.
      const result = buildNavigationPageContext({ isClientSide: false, isHydration: true } as any)
      strictEqual(result.isClientSide, true)
      strictEqual(result.isHydration, false)
    })

    it('preserves all caller-supplied fields alongside the navigation flags', () => {
      const result = buildNavigationPageContext({ urlPathname: '/about', data: { id: 1 }, title: 'About' })
      deepStrictEqual(result, {
        urlPathname: '/about',
        data: { id: 1 },
        title: 'About',
        isClientSide: true,
        isHydration: false
      })
    })
  })

  describe('resolveHydrationView', () => {
    const routes = [
      { path: '/', page: 'index', Page: async () => ({ default: () => 'home' }) }
    ] as any[]
    const errorRoute = { page: 'error', Page: async () => ({ default: () => 'error-page' }) } as any

    it('returns an empty view when not hydrating (client takeover)', async () => {
      const view = await resolveHydrationView({ urlPathname: '/' }, false, routes, errorRoute)
      deepStrictEqual(view, { Page: null, Layout: null, Head: null })
    })

    it('loads the error route view when the server reported a 404', async () => {
      const view = await resolveHydrationView({ urlPathname: '/', is404: true }, true, routes, errorRoute)
      ok(view.Page)
      strictEqual((view.Page as () => string)(), 'error-page')
    })

    it('loads the matched route view when hydrating a normal page', async () => {
      const view = await resolveHydrationView({ urlPathname: '/' }, true, routes, errorRoute)
      ok(view.Page)
      strictEqual((view.Page as () => string)(), 'home')
    })

    it('returns an empty view when hydrating a pathname that matches no route', async () => {
      const view = await resolveHydrationView({ urlPathname: '/nope' }, true, routes, null)
      deepStrictEqual(view, { Page: null, Layout: null, Head: null })
    })
  })
})
