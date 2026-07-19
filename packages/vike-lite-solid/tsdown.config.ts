import type { UserConfig } from 'tsdown'

import { assertExternal } from '../../scripts/tsdown-utils'

export default {
  entry: {
    'vite': 'src/vite.ts'
  },
  deps: {
    neverBundle: [/^virtual:/]
  },
  plugins: [assertExternal()]
} satisfies UserConfig
