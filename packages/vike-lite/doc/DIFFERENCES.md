### Differences
| Category | Functionality | `vike` | `vike-lite`
| - | - | - | -
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
| Hook | [+prerender](https://vike.dev/prerender) | ✅ | ✅ ([see](./PRERENDER.md))
| Hook | [+guard](https://vike.dev/guard) | ✅ | ⏳
| Hook | [+config](https://vike.dev/config) | ✅ | ⏳
| Hook | [+data](https://vike.dev/data) | ✅ | ✅
| Hook | [+onBeforeRoute](https://vike.dev/onBeforeRoute) | ✅ | ⏳
| Client/Server | CSP | [+csp](https://vike.dev/csp) | ([See](./CSP.md))
| Client/Server | [Internationalization (i18n)](https://vike.dev/i18n) with `+onBeforeRoute` and `modifyUrl()` | ✅ | ⏳
| Server | [pageContext](https://vike.dev/pageContext) | ✅ | ✅
| Server | [pageContext.req & pageContext.res](https://vike.dev/server#pagecontext-req-pagecontext-res) | ✅ | ⏳
| Server | [HTTP Headers](https://vike.dev/headers) in pageContext | ✅ | ❌/⏳(to check)
| Hook | [+headersResponse](https://vike.dev/headersResponse) | ✅ | ⏳
| Hook | [+title Hook](https://vike.dev/title) | ✅ | ✅
| | [File Environment (.server.js, .client.js, …)](https://vike.dev/file-env) | ✅ | ❌/⏳(to check)
| Hook | [+server](https://vike.dev/server) | ✅ | ❌ ~ use `serverEntry` option
| Server | [renderPage()](https://vike.dev/renderPage) | ✅ | ✅
| Client/Server | [abort](https://vike.dev/abort) | ✅ | ✅
| Server | [redirect()](https://vike.dev/redirect) | ✅ | ✅
| Server | [render()](https://vike.dev/render) | ✅ | ✅
| Client | [navigate()](https://vike.dev/navigate) | ✅ | ✅
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
