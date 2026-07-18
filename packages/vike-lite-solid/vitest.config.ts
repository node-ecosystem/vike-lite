import solidPlugin from 'vite-plugin-solid'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [solidPlugin({ hot: false })],
  resolve: {
    conditions: ['browser']
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/jest-dom.setup.ts'],
    server: {
      deps: { inline: [/solid-js/] }
    }
  }
})
