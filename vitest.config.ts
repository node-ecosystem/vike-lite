import { defineConfig } from 'vitest/config'

export default defineConfig({
  cacheDir: '.vite',
  test: {
    projects: ['packages/*'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**'],
      reporter: ['text', 'json', 'html']
    }
  }
})
