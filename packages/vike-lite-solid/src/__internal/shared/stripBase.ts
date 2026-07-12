/**
 * Remove the base path from the browser URL pathname. If the base path is '/', return the pathname as is.
 * @param browserPathname - The pathname from the browser's location.
 * @returns The pathname with the base path removed, or '/' if it matches the base path.
 */
export function stripBase(browserPathname: string): string {
  const { BASE_URL } = import.meta.env
  if (BASE_URL === '/') return browserPathname
  const baseSlashed = BASE_URL.endsWith('/') ? BASE_URL : BASE_URL + '/'
  const baseNoSlash = baseSlashed.slice(0, -1)
  if (browserPathname === baseNoSlash) return '/'
  if (browserPathname.startsWith(baseSlashed)) return browserPathname.slice(baseSlashed.length - 1)
  return browserPathname
}
