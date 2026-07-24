import { describe, it } from 'vitest'
import { strictEqual, ok, doesNotThrow } from 'node:assert/strict'

import vikeLite from '../src/vite/index'

interface CodeSplitGroup {
  name: string | ((moduleId: string) => string)
  test?: RegExp | ((moduleId: string) => boolean)
  priority: number
}

function resolveGroups(pagesDir: string): CodeSplitGroup[] {
  const plugin = vikeLite({ pagesDir }) as any
  const result = plugin.config(
    { base: '/', build: {}, envDir: process.cwd() },
    { command: 'build', mode: 'production' }
  )
  return result.environments.client.build.rolldownOptions.output.codeSplitting.groups
}

function getGroup(groups: CodeSplitGroup[], priority: number): CodeSplitGroup {
  const group = groups.find(g => g.priority === priority)
  ok(group, `expected a codeSplitting group with priority ${priority}`)
  return group!
}

describe('vike-lite vite plugin: pagesDir regex safety', () => {
  it('does not throw when pagesDir contains regex special characters', () => {
    doesNotThrow(() => resolveGroups('pages-v1.0'))
    doesNotThrow(() => resolveGroups('pages(v1)[beta]'))
    doesNotThrow(() => resolveGroups('pages+special.dir'))
    doesNotThrow(() => resolveGroups('src/pages(v1.0)'))
  })

  it('treats "." in pagesDir as a literal character, not "any character"', () => {
    const pagesDir = 'src/pages(v1.0)'
    const test = getGroup(resolveGroups(pagesDir), 10).test as RegExp

    ok(test.test(`/root/${pagesDir}/about/+Page.tsx`))
    // If "." were left unescaped, it would match any character (e.g. "X")
    strictEqual(test.test('/root/src/pages(v1X0)/about/+Page.tsx'), false)
  })

  it('treats "(" and ")" in pagesDir as literal characters, not a capture group', () => {
    const pagesDir = 'src/pages(v1.0)'
    const test = getGroup(resolveGroups(pagesDir), 10).test as RegExp

    // If "(" / ")" were left unescaped, they'd just group "v1.0" instead of
    // requiring literal parens, so a path *without* parens would incorrectly match.
    strictEqual(test.test('/root/src/pagesv1.0/about/+Page.tsx'), false)
  })

  it('extracts the correct page chunk name, including for files nested under a page', () => {
    const pagesDir = 'src/pages(v1.0)'
    const nameOf = getGroup(resolveGroups(pagesDir), 10).name as (id: string) => string

    strictEqual(nameOf(`/root/${pagesDir}/about/+Page.tsx`), 'page-about')
    strictEqual(nameOf(`/root/${pagesDir}/contact/components/Form.tsx`), 'page-contact')
    // Modules outside pagesDir fall back to the shared chunk
    strictEqual(nameOf('/root/src/components/Button.tsx'), 'shared')
  })

  it('extracts the correct css chunk name', () => {
    const pagesDir = 'src/pages(v1.0)'
    const cssNameOf = getGroup(resolveGroups(pagesDir), 5).name as (id: string) => string

    strictEqual(cssNameOf(`/root/${pagesDir}/contact/style.css`), 'css-contact')
    strictEqual(cssNameOf('/root/src/global.css'), 'css-shared')
  })

  it('keeps the page-name group and the css-name group in sync for the same pagesDir', () => {
    // Regression guard: each group used to inline its own escape via .replace(),
    // so it was possible to fix one occurrence and miss the other.
    const pagesDir = 'pages[v2]'
    const groups = resolveGroups(pagesDir)
    const nameOf = getGroup(groups, 10).name as (id: string) => string
    const cssNameOf = getGroup(groups, 5).name as (id: string) => string

    strictEqual(nameOf(`/root/${pagesDir}/checkout/+Page.tsx`), 'page-checkout')
    strictEqual(cssNameOf(`/root/${pagesDir}/checkout/styles.css`), 'css-checkout')
  })

  it('still works correctly with a standard pagesDir (no special characters)', () => {
    const groups = resolveGroups('pages')
    const group = getGroup(groups, 10)
    const test = group.test as RegExp
    const nameOf = group.name as (id: string) => string

    ok(test.test('/root/pages/home/+Page.tsx'))
    strictEqual(nameOf('/root/pages/home/+Page.tsx'), 'page-home')
  })
})
