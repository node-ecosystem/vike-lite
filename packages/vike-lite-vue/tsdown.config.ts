import type { UserConfig } from 'tsdown'
import Vue from 'unplugin-vue/rolldown'

export default {
  entry: {
    'index': 'src/index.ts',
    'vite': 'src/vite.ts',
    '__internal/client/onRenderClient': 'src/__internal/client/onRenderClient.ts',
    '__internal/server/onRenderHtml': 'src/__internal/server/onRenderHtml.ts'
  },
  platform: 'neutral',
  plugins: [Vue({ isProduction: true })],
  dts: { vue: true }
} satisfies UserConfig
