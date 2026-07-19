import type { UserConfig } from 'tsdown'

// Every import from node_modules must remain external (dependencies/peerDependencies):
// if a module ends up here anyway, it means it was bundled by mistake.
function assertExternal() {
  return {
    name: 'assert-external',
    transform(_code: string, id: string) {
      if (id.includes('node_modules')) {
        throw new Error(`Dependency was bundled instead of staying external: ${id}`)
      }
    }
  }
}

export default {
  entry: {
    'index': 'src/index.ts',
    'vite': 'src/vite.ts',
    '__internal/client/onRenderClient': 'src/__internal/client/onRenderClient.tsx',
    '__internal/server/onRenderHtml': 'src/__internal/server/onRenderHtml.tsx'
  },
  deps: {
    neverBundle: [/^virtual:/]
  },
  plugins: [assertExternal()]
} satisfies UserConfig
