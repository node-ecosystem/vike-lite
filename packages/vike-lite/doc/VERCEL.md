# ▲ Vercel

## 1. Vercel API file
Create `/api/ssr.js`:
```ts
import app from '../dist/server/index.mjs'

export const GET = app.fetch
export const POST = app.fetch
```

## 2. Vercel JSON file
Create `/vercel.json` in the root of your project:
```json
{
  "outputDirectory": "dist/client",
  "installCommand": "yarn install --immutable",
  "rewrites": [
    {
      "source": "/((?!assets/).*)",
      "destination": "/api/ssr.js"
    }
  ]
}
```

## 3. Vite Configuration
Depending on your needs, configure the `serverEntry` option in your `vite.config` with one of these 2 alternatives:

### A. Deploy on Vercel without a custom web server

If you don't need a custom server such as Hono/Express, disable the server entry:

```ts
// vite.config.ts
import vikeLite from 'vike-lite/vite'
import type { UserConfig } from 'vite'

export default {
  plugins: [
    vikeLite({
      // Generate a minimal dist/server/index.mjs that exposes renderPage
      serverEntry: false
    })
  ]
} satisfies UserConfig
```

### B. Deploy on Vercel with a custom server entry

If you need custom API routes, middleware, authentication, named exports, etc., use a custom server entry:

```ts
// vite.config.ts
import vikeLite from 'vike-lite/vite'
import type { UserConfig } from 'vite'

export default {
  plugins: [
    vikeLite({
      // Your custom server entry will be bundled as dist/server/index.mjs
      serverEntry: 'server/index'
    })
  ]
} satisfies UserConfig
```

>💡 **Note:** Your custom server entry must default-export an object/app exposing a fetch(request) method, [see](../README.md#️-server-integration).

### 4. Config Vercel Website
- Go to Vercel create a [new project](https://vercel.com/new)
- Search and import your repository
- In the current **Settings**:
  - **Build and Deployment**
    - `Framework Preset` = `Vite`
    - `Root Directory` = `./`
    - `Build and Output Settings`
      → `Output Directory` = `dist/client`
      → `Install Command` = `yarn install --immutable`
  - **Environments**
    - Set environment variables
  - **Functions**
    - `Fluid Compute` = `Enabled` (Recommended for Edge/Serverless performance)
