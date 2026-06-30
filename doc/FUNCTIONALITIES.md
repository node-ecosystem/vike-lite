### Differences
| Functionality | `vike` | `vike-lite`
| - | - | -
| [Filesystem Routing](https://vike.dev/routing) | ✅ | ✅
| [Routing group](https://vike.dev/routing#groups) | ✅ | ❌/⏳
| [Base URL](https://vike.dev/base-url) | ✅ | ✅
| [Active Links](https://vike.dev/active-links) | ✅ | ✅
| Static Directory (_/public_) | ✅ | ✅
| [+Page Page](https://vike.dev/Page) | ✅ | ✅
| [+Head Page](https://vike.dev/Head) | ✅ | ✅
| [+Layout Page](https://vike.dev/Layout) | ✅ | ✅
| [Error Page](https://vike.dev/error-page) | ✅ | ✅
| [+guard File](https://vike.dev/guard) | ✅ | ⏳
| [+config File](https://vike.dev/config) | ✅ | ⏳
| [+data Hook](https://vike.dev/data) | ✅ | ✅
| [pageContext.req & pageContext.res](https://vike.dev/server#pagecontext-req-pagecontext-res) | ✅ | ⏳
| [+title Hook](https://vike.dev/title) | ✅ | ✅
| [+server](https://vike.dev/server) | ✅ | ❌ ~ use `serverEntry` option
| Custom server entry and named exports ([see](https://github.com/orgs/vikejs/discussions/3334)) | ❌ | use `serverEntry` option
| [Standalone](https://vike.dev/server#standalone) | ✅ | ✅
| [HMR](https://vike.dev/server#hmr) | ✅ | ✅
| [Compression](https://vike.dev/server#compression) | ✅ | ✅/⏳(to check or replace)
| `vike dev` command | ✅ | use `vite dev`
| `vike build` command | ✅ | use `vite build`
| `vite` version | >=6.3.0 | >=8
| `Node.js` version | >=20.19.0 | >=20.19.0 || >=22.12.0

#### Legend
| Symbol | Meaning
| - | -
|✅| Implemented
|❌| Not implemented / Not needed
|⏳| On going / TODO
