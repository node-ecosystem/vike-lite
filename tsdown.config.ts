import type { UserConfig } from 'tsdown'

export default {
  entry: {
    'index': 'src/index.ts',
    'vite': 'src/vite-plugin.ts',
    'server': 'src/server/index.ts',
    '__internal/shared': 'src/shared/index.ts',
    '__internal/server': 'src/server/internal.ts'
  }
} satisfies UserConfig
