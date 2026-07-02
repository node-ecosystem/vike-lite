import type { UserConfig } from 'tsdown'

export default {
  entry: {
    'index': 'src/index.ts',
    'vite': 'src/vite-plugin.ts',
    'server': 'src/server/index.ts',
    '__internal/shared': 'src/__internal/shared/index.ts',
    '__internal/server': 'src/__internal/server.ts'
  }
} satisfies UserConfig
