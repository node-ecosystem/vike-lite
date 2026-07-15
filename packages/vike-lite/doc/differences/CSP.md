### [Content Security Policy (CSP)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP)

`vike-lite` supports Strict CSP out of the box via a `nonce` mechanism. This allows you to mitigate Cross-Site Scripting (XSS) attacks by blocking any inline script that hasn't been explicitly authorized by your server.

Because `vike-lite` uses the standard Web `Request`/`Response` API, you have full control over headers and can generate a fresh nonce for every request.

#### Usage

Simply generate a random nonce on each request, pass it to renderPage, and add it to your `Content-Security-Policy` header:

```ts
// server/index.ts
import { randomUUID } from 'node:crypto'
import { renderPage } from 'vike-lite/server'

app.get('*', async (request) => {
  // Generate a unique nonce for each request
  const nonce = randomUUID()

  // Pass the nonce at vike-lite: it will be injected into inline <script> and <link> tags
  const response = await renderPage(request, { nonce })

  // Add the CSP header authorizing only scripts with this nonce
  response.headers.set('Content-Security-Policy', `default-src 'self'; script-src 'self' 'nonce-${nonce}';`)

  return response
})
```

#### How it works
| Step | What happens
| - | -
| 1. Request arrives | The server generates a cryptographically random `nonce` (e.g. via `crypto.randomUUID()`).
| 2. Rendering | `vike-lite` injects the `nonce` into all inline `<script>` tags and preload `<link>` tags of the generated HTML.
| 3. Response | The `Content-Security-Policy` header instructs the browser to execute only the scripts marked with that specific nonce.
| 4. Browser | Any injected malicious inline script (XSS) without a valid nonce is blocked automatically.

#### Framework compatibility

The example above uses the standard `fetch` handler, but the same pattern works with any Node-based framework:

Express / Connect:

```ts
// server/index.ts
// ...
app.use(async (req, res) => {
  const nonce = randomUUID()
  const response = await renderPage(req, { nonce })
  response.headers.set('Content-Security-Policy', `script-src 'self' 'nonce-${nonce}';`)
  // ... pipe response to res
})
```

Hono / Cloudflare Workers:

```ts
// server/index.ts
// ...
app.all('*', async (c) => {
  const nonce = randomUUID()
  const response = await renderPage(c.req.raw, { nonce })
  response.headers.set('Content-Security-Policy', `script-src 'self' 'nonce-${nonce}';`)
  return response
})
```

> 💡 **Note:** Unlike Vike, which uses a dedicated [+csp](https://vike.dev/csp) file-based hook, `vike-lite` handles CSP directly at the HTTP layer. This keeps the framework minimal (no extra virtual modules or magic files) and gives you complete freedom over your security policy — including headers for images, fonts, and third-party resources.
