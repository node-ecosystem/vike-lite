import { describe, it } from 'vitest'
import { strictEqual, ok } from 'node:assert/strict'
import { stripBase, matchRoute, prependBase } from '../src/__internal/shared'

describe('vike-lite shared utils', () => {
  describe('stripBase', () => {
    it('should strip base correctly', () => {
      // BASE_URL is '' when not set in env, test behavior accordingly
      strictEqual(stripBase('/some/path'), '/some/path')
    })
  })

  describe('prependBase', () => {
    it('should prepend base correctly', () => {
      strictEqual(prependBase('/some/path'), '/some/path')
      strictEqual(prependBase('/'), '')
    })
  })

  describe('matchRoute', () => {
    it('should match static route', () => {
      const routes = [
        { path: '/', page: 'index' },
        { path: '/about', page: 'about' }
      ] as any[]

      const res = matchRoute('/about', routes)
      ok(res)
      strictEqual(res.route.path, '/about')
    })

    it('should match static route with trailing slash', () => {
      const routes = [
        { path: '/about', page: 'about' }
      ] as any[]

      const res = matchRoute('/about/', routes)
      ok(res)
      strictEqual(res.route.path, '/about')
    })

    it('should match dynamic route', () => {
      const routes = [
        { path: '/user/:id', page: 'user' }
      ] as any[]

      const res = matchRoute('/user/123', routes)
      ok(res)
      strictEqual(res.route.path, '/user/:id')
      strictEqual(res.routeParams.id, '123')
    })

    it('should return null for unmatched route', () => {
      const routes = [
        { path: '/about', page: 'about' }
      ] as any[]

      const res = matchRoute('/contact', routes)
      strictEqual(res, null)
    })
  })
})
