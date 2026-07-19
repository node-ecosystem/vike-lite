import { defineConfig } from 'eslint/config'
import pluginTypescript from 'typescript-eslint'
import pluginUnicorn from 'eslint-plugin-unicorn'
import react from 'eslint-plugin-react'
import pluginSolid from 'eslint-plugin-solid/configs/typescript'
import svelte from 'eslint-plugin-svelte'
import vue from 'eslint-plugin-vue'

export default defineConfig(
  {
    extends: [
      pluginTypescript.configs.recommended,
      pluginUnicorn.configs.recommended
    ],
    rules: {
      'comma-dangle': [1, 'never'],
      'semi': [1, 'never'],

      '@typescript-eslint/no-explicit-any': 0,
      '@typescript-eslint/no-unused-vars': [1, { argsIgnorePattern: '^_' }],

      'unicorn/empty-brace-spaces': 0,
      'unicorn/consistent-boolean-name': 0,
      'unicorn/dom-node-dataset': 0,
      'unicorn/filename-case': 0,
      'unicorn/name-replacements': 0,
      'unicorn/no-empty-file': 0,
      'unicorn/no-global-object-property-assignment': 0,
      'unicorn/no-keyword-prefix': 0,
      'unicorn/no-nested-ternary': 0,
      'unicorn/no-null': 0,
      'unicorn/no-this-outside-of-class': 0,
      'unicorn/no-top-level-side-effects': 0,
      'unicorn/numeric-separators-style': 0,
      'unicorn/prefer-node-protocol': 0
    }
  },
  {
    plugins: { react },
    files: ['packages/vike-lite-react/**/*.{ts,tsx}']
  },
  {
    files: ['packages/vike-lite-solid/**/*.{ts,tsx}'],
    extends: [pluginSolid]
  },
  {
    plugins: { svelte },
    files: ['packages/vike-lite-svelte/**/*.{ts,svelte}']
  },
  {
    plugins: { vue },
    files: ['packages/vike-lite-vue/**/*.{ts,vue}']
  }
)
