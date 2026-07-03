export class AbortRedirect extends Error {
  public url: string
  public statusCode: number

  constructor(url: string, statusCode: number = 302) {
    super(`Redirecting to ${url}`)
    this.url = url
    this.statusCode = statusCode
    Object.setPrototypeOf(this, AbortRedirect.prototype)
  }
}

/**
 * Interrupt the current rendering and redirect the user to a new URL.
 * Use with 'throw' inside +data.ts or in middleware.
 * @param url The URL to redirect to
 * @param statusCode Optional: the HTTP status code for the redirect (default is 302)
 * @example throw redirect('/login')
 */
export function redirect(url: string, statusCode: number = 302): AbortRedirect {
  return new AbortRedirect(url, statusCode)
}

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
