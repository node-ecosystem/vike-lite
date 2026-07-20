import type { UserConfig } from 'tsdown'
import Vue from 'unplugin-vue/rolldown'

import { assertExternal } from '../../scripts/tsdown-utils.ts'

export default {
  entry: {
    'index': 'src/index.ts',
    'vite': 'src/vite.ts',
    '__internal/client/onRenderClient': 'src/__internal/client/onRenderClient.ts',
    '__internal/server/onRenderHtml': 'src/__internal/server/onRenderHtml.ts'
  },
  deps: {
    neverBundle: [/^virtual:/]
  },
  plugins: [Vue({ isProduction: true }), assertExternal()]
} satisfies UserConfig
