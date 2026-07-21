### Differences
| Category | Functionality | `vike` | `vike-lite` | Migration
| - | - | - | - | -
| Routing | [Filesystem Routing](https://vike.dev/routing) | ✅ | ✅
| Routing | [Routing group](https://vike.dev/routing#groups) | ✅ | ❌/⏳
| Routing | [Base URL](https://vike.dev/base-url) | ✅ | ✅
| Routing | [Active Links](https://vike.dev/active-links) | ✅ | ✅
| Routing | [Route String](https://vike.dev/route-string) | ✅ | ❌/⏳(to check if implement `+route`)
| Routing | [Route Function](https://vike.dev/route-function) | ✅ | ❌/⏳(to check if implement `+route`)
| Routing | [Route Precedence](https://vike.dev/routing-precedence) | ✅ | ❌/⏳(to check if implement `+route`)
| Guide | [Static Directory (_/public_)](https://vike.dev/static-directory) | ✅ | ✅
| Page | [+Page](https://vike.dev/Page) | ✅ | ✅
| Page | [+Head](https://vike.dev/Head) | ✅ | ✅
| Page | [+Layout](https://vike.dev/Layout) | ✅ | ✅
| Page | [Error Page](https://vike.dev/error-page) | ✅ | ✅
| Client/Server | Pre-rendering (SSG) | [+prerender](https://vike.dev/prerender) | [Prerender](./PRERENDER.md)
| Hook | [+guard](https://vike.dev/guard) | ✅ | ⏳
| Hook | [+config](https://vike.dev/config) | ✅ | ⏳
| Hook | [+data](https://vike.dev/data) | ✅ | ✅
| Hook | [+onBeforeRoute](https://vike.dev/onBeforeRoute) | ✅ | ⏳
| Client/Server | CSP | [+csp](https://vike.dev/csp) | [CSP](./CSP.md)
| Client/Server | HTTP Streaming (SSR) | [Streaming](https://vike.dev/streaming) | [Streaming](./STREAMING.md)
| Client/Server | [Internationalization (i18n)](https://vike.dev/i18n) with `+onBeforeRoute` and `modifyUrl()` | ✅ | ⏳
| Client/Server | pageContext | [pageContext](https://vike.dev/pageContext) | [pageContext](./PAGE_CONTEXT.md)
| Server | [pageContext.req & pageContext.res](https://vike.dev/server#pagecontext-req-pagecontext-res) | ✅ | ⏳
| Server | [HTTP Headers](https://vike.dev/headers) in pageContext | ✅ | ❌/⏳(to check)
| Hook | [+headersResponse](https://vike.dev/headersResponse) | ✅ | ⏳
| Hook | [+title Hook](https://vike.dev/title) | ✅ | ✅
| | [File Environment (.server.js, .client.js, …)](https://vike.dev/file-env) | ✅ | ❌/⏳(to check)
| Hook | [+server](https://vike.dev/server) | ✅ | ❌ ~ use `serverEntry` option
| Server Integration | [renderPage()](https://vike.dev/renderPage) | ✅ | ✅ | [From `vike`](../MIGRATION.md#renderpage)
| Client/Server Abort | [abort](https://vike.dev/abort) | ✅ | ✅
| Server Abort | [redirect()](https://vike.dev/redirect) | ✅ | ✅ | [From `vike`](../MIGRATION.md#redirect)
| Server Abort | [render()](https://vike.dev/render) | ✅ | ✅ | [From `vike`](../MIGRATION.md#render)
| Client Router | [navigate()](https://vike.dev/navigate) | ✅ | ✅ | [From `vike`](../MIGRATION.md#navigate)
| Client Router | [reload()](https://vike.dev/reload) | ✅ | ✅ | [From `vike`](../MIGRATION.md#reload)
| Server | Custom server entry and named exports ([see](https://github.com/orgs/vikejs/discussions/3334)) | ❌ | use `serverEntry` option
| Server | [Compression](https://vike.dev/server#compression) | ✅ | ✅/⏳(to check or replace)
| Server | [Environment Variables](https://vike.dev/env) | ✅ | ✅
| Dev | [HMR](https://vike.dev/server#hmr) | ✅ | ✅
| Dev | [Paths Aliases](https://vike.dev/path-aliases) | ✅ | ✅
| Dev | `vike dev` command | ✅ | use `vite dev`
| CLI | [CLI as API](https://vike.dev/api) | ✅ | ❌/⏳(to check)
| Build | [Standalone](https://vike.dev/server#standalone) | ✅ | ✅
| Build | `vike*` as dev dependencies ([see](https://github.com/vikejs/vike/issues/3070)) | ❌ | ✅
| Build | `vike build` command | ✅ | use `vite build`
| Required | `vite` version | >=6.3.0 | >=8
| Required | `Node.js` version | >=20.19.0 | >=20.19.0 || >=22.12.0

#### Legend
✅: Implemented<br>
❌: Not implemented / Not needed<br>
⏳: On going / TODO
