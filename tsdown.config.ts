import type { UserConfig } from 'tsdown'

export default {
  entry: {
    'index': 'src/index.ts',
    'vite': 'src/vite-plugin.ts',
    'server': 'src/server/index.ts',
    '__internal/shared/matchRoute': 'src/shared/matchRoute.ts',
    '__internal/server/store': 'src/server/store.ts'
  }
} satisfies UserConfig
