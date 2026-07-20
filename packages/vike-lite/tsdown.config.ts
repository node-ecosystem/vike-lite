import type { UserConfig } from 'tsdown'

import { assertExternal } from '../../scripts/tsdown-utils.ts'

export default {
  entry: {
    'index': 'src/index.ts',
    'vite': 'src/vite/index.ts',
    'client/router': 'src/client/router.ts',
    'server': 'src/server/index.ts',
    'server/abort': 'src/server/abort.ts',
    '__internal/shared': 'src/__internal/shared.ts',
    '__internal/server': 'src/__internal/server.ts',
    '__internal/client': 'src/__internal/client.ts',
    '__internal/vite': 'src/__internal/vite.ts'
  },
  copy: [
    { from: 'src/vite/defaultServerEntry.mjs', to: 'dist/__internal/vite' }
  ],
  plugins: [assertExternal()]
} satisfies UserConfig
