### TODO
- `create-vike-lite` → CLI for scaffolding (pages, vite.config.ts, tsconfig)
- Pre-rendering (SSG) → ai to eng: an option `prerender: true` per route that, at build phase, run `renderPage()` for static routes and save the `.html` in `dist/client`. E.g.: `await renderPage(new Request('http://localhost/about'))`
- `base` path support → now URL and asset aspect that app lives on `/`. If an user use `example.com/mia-app/`, all breaks. Read `config.base` in vite.config and use in the link of assets and in the routes matching
- add `vite-patcher` references
- add recipes (examples folder)
