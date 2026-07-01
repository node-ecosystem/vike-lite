# vike-lite

### ⚙️ Install
| Package Manager | Command
| - | -
| **npm** | `npm install -D vike-lite`
| **yarn** | `yarn add -D vike-lite`
| **pnpm** | `pnpm add -D vike-lite`

### 📖 Usage
Add Vite plugin

```ts
// vite.config.ts
import type { UserConfig } from 'vite'
import vikeLite from 'vike-lite/vite'

export default {
  plugins: [
    vikeLite({
      pagesDir = 'pages', // default
      serverEntry = 'server/index', // default
      apiPrefix = '/api'  // default
    })
  ]
} satisfies UserConfig
```

### 🪝 Hooks

#### renderPage
```ts
// /server/index.ts
import { cors } from 'hono/cors'
import { Hono } from 'hono'
import { renderPage } from 'vike-lite/server'

import apiRoutes from './apiRoutes'

const app = new Hono()

if (process.env.NODE_ENV === 'production') {
  app.use(cors())
}

app.route('/api', apiRoutes)

// Catch-all remaining requests (pages) using custom rendering
app.get('*', async (c, next) => {
  const response = await renderPage(c.req.raw)
  return response ?? next()
})

app.onError((error, c) => {
  console.error(error)
  return c.json({ error: 'Internal Server Error' }, 500)
})

export default app
```

> Note: if you don't use a custom server (loaded by the `serverEntry` option), a default server is bundled. In PROD the server is started as follow:
```ts
// startServer.mjs
import './dist/server/index.mjs'
```

### 🫶 Contribution
Clone
```sh
git clone https://github.com/node-ecosystem/vike-lite.git
```

---

This project is licensed under the [MIT License](LICENSE).
