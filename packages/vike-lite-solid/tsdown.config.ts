import type { UserConfig } from 'tsdown'

import { assertExternal } from '../../scripts/tsdown-utils.ts'

export default {
  entry: {
    'vite': 'src/vite.ts'
  },
  deps: {
    neverBundle: [/^virtual:/]
  },
  plugins: [assertExternal()]
} satisfies UserConfig
