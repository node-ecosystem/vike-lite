export function escapeRegex(str: string) {
  return str.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)
}
