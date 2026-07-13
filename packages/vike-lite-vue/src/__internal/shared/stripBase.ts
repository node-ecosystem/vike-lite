export function stripBase(pathname: string): string {
  const { BASE_URL } = import.meta.env
  if (BASE_URL === '/' || !pathname.startsWith(BASE_URL)) return pathname
  const stripped = pathname.slice(BASE_URL.length)
  return stripped.startsWith('/') ? stripped : '/' + stripped
}
