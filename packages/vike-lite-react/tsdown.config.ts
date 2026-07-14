import type { UserConfig } from 'tsdown'

export default {
  entry: {
    'index': 'src/index.ts',
    'vite': 'src/vite.ts',
    '__internal/client/onRenderClient': 'src/__internal/client/onRenderClient.tsx',
    '__internal/server/onRenderHtml': 'src/__internal/server/onRenderHtml.tsx'
  },
  deps: {
    neverBundle: [/^virtual:/]
  }
} satisfies UserConfig
