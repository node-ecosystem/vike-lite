import type { UserConfig } from 'tsdown'

export default {
  entry: {
    'vite': 'src/vite.ts'
  },
  deps: {
    neverBundle: [/^virtual:/]
  }
} satisfies UserConfig
