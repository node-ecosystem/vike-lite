### Pre-rendering ~ Static Site Generation (SSG)

#### SSR as default ~ SSG only on some pages
`vike-lite` as default has SSR enabled on all pages.
On some page, you can pre-render SSG:
```ts
// pages/admin/+prerender.ts
export default true
```

#### SSG as default ~ SSR only on some pages
```ts
// vite.config.ts
import type { UserConfig } from 'vite'
import vikeLite from 'vike-lite/vite'

export default {
  plugins: [
    vikeLite({
      prerender = true  // Enable pre-rendering
    })
  ]
} satisfies UserConfig
```

On some page, disable pre-rendering SSG and use SSR:
```ts
// pages/admin/+prerender.ts
export default false
```

#### Dynamic routes
With a dynamic route, you can pre-render by the parameter value.
E.g.:
Having `pages/post/@slug/+Page.tsx` (URL: `/post/:slug`), you can pre-render at build most important items.
```ts
// pages/post/@slug/+prerender.ts
export default async function prerender() {
  const posts = await fetch('https://api.my-db.com/top-posts').then(r => r.json())

  // Return the array of routes to generate!
  return posts.map(post => `/post/${post.slug}`)
}
```

