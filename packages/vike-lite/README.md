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
      pagesDir: 'pages',           // Directory containing your pages
      apiPrefix: '/api',           // Prefix to bypass SSR for API routes
      prerender: false,            // Enable SSG globally
      serverEntry: 'server/index', // Allows to use a custom server entry file
      analizeDependencies: false   // Print, at the end of the build, a dependency usage/audit table
    })
  ]
} satisfies UserConfig
```

#### `analizeDependencies`

When set to `true`, at the end of the production build (once both the client and server builds have finished), the plugin prints a single table cross-referencing every `dependency`/`devDependency`/`peerDependency` in your `package.json` with whether it ended up in the client bundle, the server bundle, both, or neither — and flags anything worth fixing.

> 📦 Dependency usage report:
> |Used by Client|Used by Server|Type|Dependency name|Alert
> |-|-|-|-|-
> |✅|✅|dependency|solid-js@^1.9.3|💡 ~ safely bundled, can move to dev dependencies
> ||✅|dependency|hono@^4.12.31|
> ||✅|dev dependency| postgres@^3.4.4 |🚨 ~ move to dependencies
> |||dependency|lodash@^4.17.21 |💡/🗑️ ~ move to dev dependencies or remove

**Alerts explained:**

- 🚨 **Fatal** ~ Move to `dependencies`

  A `devDependency` ended up externalized (imported at runtime from `node_modules` instead of bundled). This is strictly reserved for things that will break a production server: deploying with `npm ci --omit=dev` will cause a `MODULE_NOT_FOUND` crash because the package won't be installed.
__Fix:__ Move the package to `dependencies`.

- 💡 **Optimization** ~ Safely bundled, can move to `devDependencies`

  A regular dependency is used, but it is 100% **bundled** into the final build (like UI frameworks or tiny utils). It works perfectly fine where it is, but moving it to `devDependencies` is a pro-tip to shrink the actual `node_modules` weight shipped to production.

- 💡/🗑️ **Unused** ~ Move to `devDependencies` or remove

  A regular dependency is completely absent from both the client and server output. It is pure dead weight in your production deployment. It's either dead code you can remove, or a build/dev-only tool (like ESLint or `@types/*`) accidentally placed in the wrong list.

- **OK** ~ No alert

  The dependency is correctly placed and harmless. This applies to regular dependencies that are externalized (e.g. `hono` or `express`), or `devDependencies` that pass through silently because they are either build tools (like `vite`, `vike-lite` or `typescript`) or 100% bundled libraries (like `nanoid`).


##### Summary: What this catches
- 🚨 **Production Crashes:** Flags `devDependencies` that are actively required by the server at runtime. Move these to `dependencies`.
- 💡 **Server Bloat:** Flags regular `dependencies` that are 100% bundled into the build. Move these to `devDependencies` shrinks your production `node_modules` size.
- 🗑️ **Unused Packages**: Highlights dependencies taking up space in your `package.json` that never appeared in the final build graph.

It's disabled by default since it adds diagnostic console output and isn't needed for normal usage, but it is highly recommended to run occasionally to audit your packages.

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
  return await renderPage(c.req.raw, {
    // Optionally you can pass headers to get them from PageContext parameter of +data hook
    headers: c.req.raw.headers  // OR c.req.header()
  })
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
