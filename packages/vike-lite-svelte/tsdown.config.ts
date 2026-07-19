import type { UserConfig } from 'tsdown'

// Every import from node_modules must remain external (dependencies/peerDependencies):
// if a module ends up here anyway, it means it was bundled by mistake.
export function assertExternal() {
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
    'vite': 'src/vite.ts'
  },
  deps: {
    neverBundle: [/^virtual:/]
  },
  plugins: [assertExternal()]
} satisfies UserConfig
