import { describe, it } from 'vitest'
import { strictEqual } from 'node:assert/strict'
import { extractPkgName } from '../src/vite/analizeDependencies'

describe('extractPkgName', () => {
  it('resolves plain npm node_modules paths', () => {
    strictEqual(extractPkgName('/root/node_modules/react/index.js'), 'react')
  })

  it('resolves scoped packages', () => {
    strictEqual(extractPkgName('/root/node_modules/@babel/core/lib/index.js'), '@babel/core')
  })

  it('resolves nested (non-hoisted) node_modules to the innermost package', () => {
    strictEqual(extractPkgName('/root/node_modules/foo/node_modules/bar/index.js'), 'bar')
  })

  it('resolves pnpm .pnpm store paths, skipping the .pnpm segment', () => {
    strictEqual(
      extractPkgName('/root/node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/lodash.js'),
      'lodash'
    )
  })

  it('resolves pnpm scoped packages with peer-dep suffixes in the store path', () => {
    strictEqual(
      extractPkgName('/root/node_modules/.pnpm/@babel+core@7.20.0_bar@2.0.0/node_modules/@babel/core/lib/index.js'),
      '@babel/core'
    )
  })

  it('resolves yarn PnP virtual package paths to the real package name', () => {
    strictEqual(
      extractPkgName('.yarn/__virtual__/eslint-virtual-abc123/0/node_modules/eslint/lib/api.js'),
      'eslint'
    )
  })

  it('resolves yarn unplugged/cache paths to the real package name', () => {
    strictEqual(
      extractPkgName('.yarn/unplugged/lodash-npm-4.17.21-hash/node_modules/lodash/lodash.js'),
      'lodash'
    )
  })

  it('resolves bare specifiers (externalized SSR dependencies)', () => {
    strictEqual(extractPkgName('react'), 'react')
    strictEqual(extractPkgName('lodash/debounce'), 'lodash')
    strictEqual(extractPkgName('@aws-sdk/client-s3/dist-cjs/index.js'), '@aws-sdk/client-s3')
  })

  it('returns null for relative paths', () => {
    strictEqual(extractPkgName('./components/Button.tsx'), null)
    strictEqual(extractPkgName('../shared/utils.ts'), null)
  })

  it('returns null for Node builtins and virtual module ids', () => {
    strictEqual(extractPkgName('node:fs'), null)
    strictEqual(extractPkgName('virtual:vike-lite/routes'), null)
  })

  it('returns null for absolute project-local paths outside node_modules', () => {
    strictEqual(extractPkgName('/root/src/components/Button.tsx'), null)
  })

  it('normalizes Windows-style backslashes before matching', () => {
    strictEqual(extractPkgName('C:\\root\\node_modules\\react\\index.js'), 'react')
  })
})
