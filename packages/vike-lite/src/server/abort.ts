export class AbortRender extends Error {
  public statusCode: number
  public reason: string | undefined

  constructor(statusCode: number, reason?: string) {
    super(`Render aborted with status ${statusCode}: ${reason || ''}`)
    this.statusCode = statusCode
    this.reason = reason
  }
}

export function render(statusCode: number, reason?: string) {
  return new AbortRender(statusCode, reason)
}
