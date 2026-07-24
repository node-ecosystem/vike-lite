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

When set to `true`, at the end of each production build (client and server), the plugin prints the list of `package.json` dependencies (and devDependencies) that were actually bundled or externally imported in that specific build output.

More importantly, it cross-references this usage with your `package.json` to provide **smart suggestions** to prevent production crashes and optimize your deployment size.

```sh
📦 [Client bundle] 1 dependencies used from package.json:
   - solid-js@^1.9.3 (bundled)

📦 [Server bundle] 3 dependencies used from package.json:
   - solid-js@^1.9.3 (bundled)
   - hono@^4.12.31 (external)
   - postgres@^3.4.4 [dev] (external)

   Suggestions:
   🚨 postgres is externalized in the server bundle but listed as a devDependency. Move it to dependencies or it will break in production.
   💡 solid-js is always fully bundled (never externalized). Consider moving it to devDependencies to reduce production node_modules size.
   🗑️ lodash@4.17.21 is listed in "dependencies" but wasn't found in any bundle — if it's only needed at build/dev time, move it to devDependencies (or remove it if unused).
```

##### What it catches:
- 🚨 **Production Crashes:** Flags devDependencies that are externalized by the server (if left as dev dependencies, your app will crash in production environments that use `npm ci --omit=dev`).
- 💡 **Server Bloat:** Flags regular dependencies that are 100% bundled into the build. Moving these to `devDependencies` shrinks your production node_modules size.
- 🗑️ **Unused Packages**: Highlights dependencies taking up space in your `package.json` that never appeared in the final build graph.

It's disabled by default since it adds diagnostic console output and isn't needed for normal usage, but it is highly recommended to run occasionally to audit your packages.

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
