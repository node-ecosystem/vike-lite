export class AbortRender extends Error {
  public statusCode: number
  public reason?: unknown

  constructor(statusCode: number, reason?: unknown) {
    super(`Render aborted with status ${statusCode}${reason && typeof reason === 'string' ? `: ${reason}` : ''}`)

    this.statusCode = statusCode
    this.reason = reason

    Object.setPrototypeOf(this, AbortRender.prototype)
  }
}

/**
 * Interrupt the current rendering and display the error page.
 * Always use with 'throw': throw render(404, 'Not Found')
 * 
 * @param statusCode The HTTP status code (e.g. 404, 401, 500)
 * @param reason Optional: the reason for the error to display in the UI
 */
export function render(statusCode: number, reason?: unknown): AbortRender {
  return new AbortRender(statusCode, reason)
}
