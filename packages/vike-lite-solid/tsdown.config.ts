import type { UserConfig } from 'tsdown'

export default {
  entry: {
    'index': 'src/index.ts',
    'vite': 'src/vite-plugin.ts'
  }
} satisfies UserConfig
