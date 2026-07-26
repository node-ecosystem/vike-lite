import type { PageContextServer } from '..'

const ESCAPE_LOOKUP: Record<string, string> = {
  '&': String.raw`\u0026`,
  '>': String.raw`\u003e`,
  '<': String.raw`\u003c`,
  '\u{2028}': String.raw`\u2028`,
  '\u{2029}': String.raw`\u2029`
}
const ESCAPE_REGEX = /[&><\u{2028}\u{2029}]/gu

// Fields that exist on PageContextServer but must never reach the browser
export function toClientPageContext(
  { headers, ...safeContext }: PageContextServer
): Omit<PageContextServer, 'headers'> {
  return safeContext
}

export function serializeContext(pageContext: PageContextServer): string {
  return JSON.stringify(toClientPageContext(pageContext)).replaceAll(ESCAPE_REGEX, (match) => ESCAPE_LOOKUP[match])
}
