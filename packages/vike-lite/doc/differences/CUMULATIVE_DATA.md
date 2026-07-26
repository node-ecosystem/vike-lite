### `+data` ~ Cumulative Data

Like `+Layout` and `+Head`, `+data` in `vike-lite` is **hierarchical**: you can place a `+data.ts` file
in *any* directory of your `pages/` tree, not only next to `+Page`. Every `+data.ts` found from the
root down to the matched page is executed **in order (root → leaf)** and the results are **merged**
into a single `pageContext.data` object, available to `+Page`, `+Layout`, and `+Head` via the
`useData()` hook.

This lets you colocate data with the layout/route level that actually needs it, instead of
re-fetching (or manually threading) shared data — like the current session, a navigation menu, or a
tenant — in every leaf page.

```sh
pages/
├── +data.ts # (1) runs first → { session }
├── admin/
│   ├── +Layout.tsx
│   ├── +data.ts # (2) runs second → { menu }, can read { session }
│   └── dashboard/
│       ├── +Page.tsx
│       └── +data.ts # (3) runs third → { stats }, can read { session, menu }
```

For the `/admin/dashboard` route, `pageContext.data` ends up as:
```ts
{ session, menu, stats }
```

### Usage

Each `+data.ts` receives the pageContext built so far — including `data` already produced by its ancestors — and returns a (partial) value that gets merged in.

```ts
// pages/+data.ts
export const data = async (pageContext) => {
  return { session: await getSession(pageContext) }
}

// pages/admin/+data.ts
export const data = async (pageContext) => {
  // pageContext.data.session is already available here
  const menu = await getAdminMenu(pageContext.data.session)
  return { menu }
}

// pages/admin/dashboard/+data.ts
export const data = async (pageContext) => {
  // pageContext.data.{session, menu} are already available here
  const stats = await getStats(pageContext.data.session)
  return { stats }
}
```

Access the fully merged result with `useData()`, exactly as usual — including inside `+Layout` and `+Head`, since they render inside the same page context as `+Page`:

```tsx
// pages/admin/+Layout.tsx
import { useData } from 'vike-lite-react'

type Data = { session: Session; menu: MenuItem[] }

export default function Layout({ children }: { children: React.ReactNode }) {
  const [data] = useData<Data>() // { session, menu }
  return (
    <div>
      <nav>{data.menu.map(item => <a key={item.id} href={item.href}>{item.label}</a>)}</nav>
      {children}
    </div>
  )
}

// pages/admin/dashboard/+Page.tsx
import { useData } from 'vike-lite-react'

type Data = { session: Session; menu: MenuItem[]; stats: Stats }

export default function Page() {
  const [data] = useData<Data>() // { session, menu, stats }
  return <h1>Total: {data.stats.total}</h1>
}
```

> **Note:** the same `+data.ts` cumulative behavior and `useData()` API is available identically in `vike-lite-react`, `vike-lite-vue`, `vike-lite-solid`, and `vike-lite-svelte`.

### How it works
|Step|What happens
|-|-
|1. Route matching|`vike-lite` matches the URL and resolves the ordered list of `+data.ts` files, collected from the root of `pagesDir` down to the matched page's directory (the same traversal used for `+Layout`/`+Head`).
|2. Sequential execution|Each `+data` function is await-ed one at a time, in root → leaf order — not in parallel — because a child `+data` may depend on data produced by its ancestors.
|3. Merge|After each `+data` resolves, its return value is merged into `pageContext.data` before the next one runs.
|4. Serve|The final, fully merged pageContext.data is what gets serialized into `__PAGE_CONTEXT__` (SSR/SSG) or returned by the `.pageContext.json` endpoint (client-side navigation). The client never sees or re-executes individual `+data` files.

### Merge rule
Merging uses a simple, predictable rule so behavior stays easy to reason about:
- If **both** the value accumulated so far and the new `+data` result are **plain objects**, they are **shallow-merged**: `{ ...prev, ...next }`. A deeper (more specific) `+data` wins on key conflicts — same precedence as `+Layout`/`+Head` resolution.
- Otherwise (the new result is an array, a primitive, `null`, etc.), it **fully replaces** the accumulated value.
- Returning `undefined` from a `+data` function is a no-op: the previous value is kept unchanged.

```ts
// pages/+data.ts
export const data = () => ({ user: null, theme: 'light' })

// pages/settings/+data.ts
export const data = (pageContext) => ({ theme: 'dark' })
// => pageContext.data === { user: null, theme: 'dark' }
```

If you need a different merge strategy (e.g. deep-merge nested objects, or explicit array
concatenation), do it yourself inside the `+data` function using pageContext.data:

```ts
export const data = (pageContext) => {
  const prevTags = pageContext.data?.tags ?? []
  return { tags: [...prevTags, 'new-tag'] }
}
```

### Aborting the chain

`redirect()` and `render()` (from `vike-lite/server/abort`) work exactly as before, and thrown from any `+data` in the chain immediately stops execution — none of the descendant `+data` functions run. This makes root/ancestor `+data` files a natural place for cross-cutting guards:

```ts
// pages/admin/+data.ts
import { redirect } from 'vike-lite/server/abort'

export const data = (pageContext) => {
  if (!pageContext.data.session) throw redirect('/login')
  return { menu: getAdminMenu() }
}
```

Since `pages/admin/+data.ts` runs before `pages/admin/dashboard/+data.ts`, the dashboard's `+data` (and its expensive `getStats()` call) never executes for unauthenticated users.

### TypeScript tips
Because `pageContext.data` grows incrementally as the chain executes, type each `+data.ts`'s parameter loosely against the data available at that level (or share a single `Partial<AppData>` type across the whole chain), and only assert the fully-resolved shape where you actually consume it with useData<FullData>():

```tsx
// shared/types.ts
export interface AppData {
  session?: Session
  menu?: MenuItem[]
  stats?: Stats
}

// pages/admin/+data.ts
import type { PageContext } from 'vike-lite'
import type { AppData } from '../../shared/types'

export const data = (pageContext: PageContext<AppData>) => {
  // pageContext.data.session: Session | undefined
  return { menu: getAdminMenu(pageContext.data.session) }
}

// pages/admin/dashboard/+Page.tsx
import { useData } from 'vike-lite-react'
import type { AppData } from '../../../shared/types'

// At this leaf, session/menu/stats are all guaranteed to have run:
type DashboardData = Required<AppData>

export default function Page() {
  const [data] = useData<DashboardData>()
  return <h1>{data.stats.total}</h1>
}
```

### Differences from `vike`
|Feature|`vike`|`vike-lite`
|-|-|-
|`+data` location|Only next to `+Page`|Any ancestor directory (like `+Layout`/`+Head`)
|Multiple `+data` per route|N/A|Cumulative chain, root → leaf
|Merge strategy|N/A|Shallow-merge for plain objects, replace otherwise
|Execution order|N/A|Sequential (each `+data` can read its ancestors' results)
