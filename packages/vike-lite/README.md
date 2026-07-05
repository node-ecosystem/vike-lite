# vike-lite

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
Add the `vike-lite` plugin to your `vite.config.ts`.

```ts
// vite.config.ts
import type { UserConfig } from 'vite'
import vikeLite from 'vike-lite/vite'

export default {
  plugins: [
    vikeLite({
      pagesDir: 'pages',           // Default: Directory containing your pages
      serverEntry: 'server/index', // Default: Custom server entry file
      apiPrefix: '/api',           // Default: Prefix to bypass SSR for API routes
      prerender: false             // Default: Enable SSG globally
    })
  ]
} satisfies UserConfig
```

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
  const response = await renderPage(c.req.raw)
  // If vike-lite successfully renders a page, return it. Otherwise, continue.
  return response ?? next()
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
