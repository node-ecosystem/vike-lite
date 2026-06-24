import type { UserConfig } from 'tsdown'

export default {
  entry: {
    'index': 'src/index.ts',
    'vite': 'src/vite-plugin.ts',
    'server': 'src/server/index.ts',
    'shared': 'src/shared/index.ts'
  }
} satisfies UserConfig
