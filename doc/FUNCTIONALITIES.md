### Differences
| Category | Functionality | `vike` | `vike-lite`
| - | - | - | -
| Routing | [Filesystem Routing](https://vike.dev/routing) | ✅ | ✅
| Routing | [Routing group](https://vike.dev/routing#groups) | ✅ | ❌/⏳
| Routing | [Base URL](https://vike.dev/base-url) | ✅ | ✅
| Routing | [Active Links](https://vike.dev/active-links) | ✅ | ✅
| Guide | [Static Directory (_/public_)](https://vike.dev/static-directory) | ✅ | ✅
| Page | [+Page](https://vike.dev/Page) | ✅ | ✅
| Page | [+Head](https://vike.dev/Head) | ✅ | ✅
| Page | [+Layout](https://vike.dev/Layout) | ✅ | ✅
| Page | [Error Page](https://vike.dev/error-page) | ✅ | ✅
| Hook | [+guard](https://vike.dev/guard) | ✅ | ⏳
| Hook | [+config](https://vike.dev/config) | ✅ | ⏳
| Hook | [+data](https://vike.dev/data) | ✅ | ✅
| Hook | [+onBeforeRoute](https://vike.dev/onBeforeRoute) | ✅ | ⏳
| | [Internationalization (i18n)](https://vike.dev/i18n) with `+onBeforeRoute` | ✅ | ⏳
| | [pageContext](https://vike.dev/pageContext) | ✅ | ✅
| | [pageContext.req & pageContext.res](https://vike.dev/server#pagecontext-req-pagecontext-res) | ✅ | ⏳
| | [HTTP Headers](https://vike.dev/headers) in pageContext | ✅ | ❌/⏳(to check)
| Hook | [+headersResponse](https://vike.dev/headersResponse) | ✅ | ⏳
| Hook | [+title Hook](https://vike.dev/title) | ✅ | ✅
| | [File Environment (.server.js, .client.js, …)](https://vike.dev/file-env) | ✅ | ❌/⏳(to check)
| Hook | [+server](https://vike.dev/server) | ✅ | ❌ ~ use `serverEntry` option
| | Custom server entry and named exports ([see](https://github.com/orgs/vikejs/discussions/3334)) | ❌ | use `serverEntry` option
| Util | [renderPage](https://vike.dev/renderPage) | ✅ | ✅
| | [Standalone](https://vike.dev/server#standalone) | ✅ | ✅
| | [HMR](https://vike.dev/server#hmr) | ✅ | ✅
| | [Compression](https://vike.dev/server#compression) | ✅ | ✅/⏳(to check or replace)
| | [Environment Variables](https://vike.dev/env) | ✅ | ✅/⏳(to check or replace)
| | [Paths Aliases](https://vike.dev/path-aliases) | ✅ | ✅
| | `vike dev` command | ✅ | use `vite dev`
| | `vike build` command | ✅ | use `vite build`
| | `vite` version | >=6.3.0 | >=8
| | `Node.js` version | >=20.19.0 | >=20.19.0 || >=22.12.0

#### Legend
| Symbol | Meaning
| - | -
|✅| Implemented
|❌| Not implemented / Not needed
|⏳| On going / TODO
