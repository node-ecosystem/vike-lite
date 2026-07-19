import { defineConfig } from 'eslint/config'
import pluginTypescript from 'typescript-eslint'
import svelte from 'eslint-plugin-svelte'

export default defineConfig(
  {
    extends: [
      pluginTypescript.configs.recommended
    ],
    rules: {
      'comma-dangle': [1, 'never'],
      'semi': [1, 'never'],

      '@typescript-eslint/no-explicit-any': 0,
      '@typescript-eslint/no-unused-vars': [1, { argsIgnorePattern: '^_' }],
    }
  },
  {
    plugins: { svelte },
    files: ['packages/vike-lite-svelte/**/*.{ts,svelte}']
  }
)
