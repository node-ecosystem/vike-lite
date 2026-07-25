# Common build use cases

#### Build scripts
You can choose to build all environments (client and server) on only 1.
```json
// package.json
{
  "scripts": {
    "build": "vite build",
    "build:client": "BUILD_TARGET=client vite build",
    "build:server": "BUILD_TARGET=server vite build"
  }
}
```

#### Minification
You can minify code (`.mjs` files) and CSS (`.css` files).
```ts
// vite.config.ts
import type { UserConfig } from 'vite'

export default {
  build: {
    minify: true  // use the default minifier (oxc and lighting) of vite
  }
} satisfies UserConfig
```

#### Broken npm package
See [Broken npm package](https://vike.dev/broken-npm-package).

#### Reduce size of server bundle
[standaloner](https://www.npmjs.com/package/standaloner).
This can also fix some issue with [broken npm packages](#broken-npm-package).

Install `standaloner` as dev dependencies
```sh
# npm
npm install -D standaloner

# pnpm
pnpm add -D standaloner

# yarn
yarn add -D standaloner
```

and add to `vite.config`
```ts
// vite.config.ts
import type { UserConfig } from 'vite'

// Optimize the startup of vite dev
const prodPlugins = []
if (process.env.NODE_ENV === 'production') {
  prodPlugins.push((await import('standaloner/vite')).default({
    bundle: true,
    minify: true
  }))
}

export default {
  plugins: [
    ...prodPlugins
  ]
} satisfies UserConfig
```
