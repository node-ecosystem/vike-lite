### Pre-rendering ~ Static Site Generation (SSG)

`vike-lite` allows you to seamlessly mix Server-Side Rendering (SSR) and Static Site Generation (SSG) depending on your application's needs.

#### SSR as default ~ SSG only on specific pages
By default, `vike-lite` enables Server-Side Rendering (SSR) for all pages.
To opt-in to Static Site Generation (SSG) for a specific page, export `true` in its `+prerender.ts` file:
```ts
// pages/admin/+prerender.ts
export default true
```

#### SSG as default ~ SSR only on specific pages
If your application is mostly static, you can enable pre-rendering globally in your Vite config:
```ts
// vite.config.ts
import type { UserConfig } from 'vite'
import vikeLite from 'vike-lite/vite'

export default {
  plugins: [
    vikeLite({
      prerender: true  // Enable pre-rendering
    })
  ]
} satisfies UserConfig
```

You can then opt-out of pre-rendering and fall back to SSR for specific pages (like an admin dashboard) by exporting `false`:
```ts
// pages/admin/+prerender.ts
export default false
```

#### Dynamic routes
To pre-render dynamic routes, you must provide the specific parameter values you want to generate at build time.

For example, given the route `pages/post/@slug/+Page.tsx` (URL: `/post/:slug`), you can fetch data and return an array of URLs to pre-render the most important items:
```ts
// pages/post/@slug/+prerender.ts
export default async function prerender() {
  const posts = await fetch('https://api.my-db.com/top-posts').then(r => r.json()) as { slug: string }[]

  // Return the array of routes to generate
  return posts.map(post => `/post/${post.slug}`)
}
```
