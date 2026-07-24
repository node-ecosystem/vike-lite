# Vike Lite
<a href="https://npmjs.com/package/vike-lite"><img src="https://img.shields.io/npm/v/vike-lite.svg" alt="npm package"></a>

A lightweight, fast, and minimal framework for Server-Side Rendering (SSR) and Static Site Generation (SSG) inspired by [Vike](https://vike.dev).

### ⚙️ Install
Install `vike-lite`
```sh
# npm
npm install -D vike-lite

# pnpm
pnpm add -D vike-lite

# yarn
yarn add -D vike-lite
```

### 📖 Usage
Add the `vike-lite` plugin to your `vite.config`.

```ts
// vite.config.ts
import vikeLite from 'vike-lite/vite'
import type { UserConfig } from 'vite'

export default {
  plugins: [
    vikeLite({
      pagesDir: 'pages',           // Default: Directory containing your pages
      apiPrefix: '/api',           // Default: Prefix to bypass SSR for API routes
      prerender: false,            // Default: Enable SSG globally
      serverEntry: 'server/index', // Default: unfedined value that allows to use a custom server entry file
      printDependencies: false     // Default: Print, per build (client/server), which package.json dependencies ended up in the bundle
    })
  ]
} satisfies UserConfig
```

#### printDependencies

When set to `true`, at the end of each production build (client and server) the plugin prints the list of `package.json` dependencies (and devDependencies) that were actually bundled or externally imported in that specific build output. This is useful to debug bundle composition/size — e.g. spotting a heavy dependency that unexpectedly ended up in the client bundle.

```sh

📦 [Client bundle] 1 dependencies used from package.json:
   - solid-js@^1.9.3

📦 [Server bundle] 2 dependencies used from package.json:
   - solid-js@^1.9.3
   - hono@^4.12.31
```

It's disabled by default since it only adds diagnostic console output and isn't needed for normal usage.

### 🖥️ Server Integration

#### `renderPage()`
If you want to use a custom server (like Hono, Express, or Fastify), you can use the renderPage utility to handle your frontend routes.

Here is an example using Hono:

```ts
// /server/index.ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { renderPage } from 'vike-lite/server'

import apiRoutes from './apiRoutes'

const app = new Hono()

if (process.env.NODE_ENV === 'production') {
  app.use(cors())
}

// 1. Handle API routes first
app.route('/api', apiRoutes)

// 2. Catch-all remaining requests and pass them to vike-lite
app.get('*', async (c, next) => {
  // renderPage will return a Node.js Response
  return await renderPage(c.req.raw)
})

// 3. Error Handling
app.onError((error, c) => {
  console.error(error)
  return c.json({ error: 'Internal Server Error' }, 500)
})

export default app
```

>💡 **Note on Default Server:** if you don't need a custom backend and skip the `serverEntry` option, `vike-lite` bundles a default server for you out of the box. In production, it will be automatically started via an auto-generated entry point:

```mjs
// startServer.mjs
import './dist/server/index.mjs'
```

---

This project is licensed under the [MIT License](../../LICENSE).
