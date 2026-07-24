import { describe, it } from 'vitest'
import { strictEqual, ok } from 'node:assert/strict'

import { escapeRegex, stripBase, matchRoute, prependBase } from '../src/__internal/shared'

describe('vike-lite shared utils', () => {
  describe('escapeRegex', () => {
    it('escapes regex metacharacters so they are treated as literals', () => {
      const escaped = escapeRegex('pages-v1.0')
      const re = new RegExp(escaped)
      // "." must be literal, not "any character"
      ok(re.test('pages-v1.0'))
      ok(!re.test('pages-v1X0'))
    })

    it('escapes parentheses and brackets so they do not throw when compiled', () => {
      const dangerous = 'pages(v1)[beta]+{x}'
      const escaped = escapeRegex(dangerous)
      let re: RegExp | undefined
      // Would throw "Invalid regular expression" if left unescaped
      re = new RegExp(escaped)
      ok(re.test(dangerous))
      ok(!re.test('pagesv1betax'))
    })

    it('leaves plain alphanumeric strings unchanged', () => {
      strictEqual(escapeRegex('pages'), 'pages')
    })

    it('escapes backslashes correctly', () => {
      const escaped = escapeRegex('a\\b')
      const re = new RegExp(escaped)
      ok(re.test('a\\b'))
    })
  })

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
