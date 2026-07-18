import { describe, it } from 'vitest'
import { strictEqual } from 'node:assert/strict'
import { serializeContext } from '../src/utils/serializeContext'

describe('vike-lite utils serializeContext', () => {
  it('should serialize basic object', () => {
    const obj = { a: 1, b: "test" }
    const res = serializeContext(obj)
    strictEqual(res, '{"a":1,"b":"test"}')
  })

  it('should escape dangerous script injection characters', () => {
    // Includes script tag, unicode line separators
    const obj = { html: "<script>alert('&')</script>\u{2028}\u{2029}" }
    const res = serializeContext(obj)
    strictEqual(res, String.raw`{"html":"\u003cscript\u003ealert('\u0026')\u003c/script\u003e\u2028\u2029"}`)
  })
})
