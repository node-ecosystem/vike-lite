import { describe, it } from 'vitest'
import { strictEqual, ok } from 'node:assert/strict'
import { createRoutePrefetcher, buildPageContextJsonUrl } from '../src/__internal/client'

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
})
