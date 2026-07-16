const ESCAPE_LOOKUP: Record<string, string> = {
  '&': String.raw`\u0026`,
  '>': String.raw`\u003e`,
  '<': String.raw`\u003c`,
  '\u{2028}': String.raw`\u2028`,
  '\u{2029}': String.raw`\u2029`
}
const ESCAPE_REGEX = /[&><\u{2028}\u{2029}]/gu

export function serializeContext(data: unknown): string {
  return JSON.stringify(data).replaceAll(ESCAPE_REGEX, (match) => ESCAPE_LOOKUP[match]!)
}
