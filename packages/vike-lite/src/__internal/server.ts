export * from '../server/store'

interface HtmlShellParams {
  pageTitleTag: string
  cssLinks: string
  jsPreloads: string
  /** Statically rendered <head> content (not part of the hydrated tree). */
  headHtml: string
  /** Server-rendered app markup, or '' in Client Takeover mode. */
  appHtml: string
  serializedContext: string
  entryClient: string
  nonce?: string
  /**
   * Extra markup injected right after `headHtml`, before the context script.
   * Used by Solid for `generateHydrationScript()`.
   */
  extraHeadHtml?: string
}

/**
 * Renders the HTML document shell shared by every adapter: doctype, meta tags,
 * asset links, the injected `__PAGE_CONTEXT__` script, the root container and
 * the client entry script. Centralized so that CSP nonce handling (and any other
 * cross-cutting concern) is applied consistently instead of drifting between
 * React/Vue/Solid, as it did before this was factored out.
 */
export function renderHtmlShell({
  pageTitleTag,
  cssLinks,
  jsPreloads,
  headHtml,
  appHtml,
  serializedContext,
  entryClient,
  nonce,
  extraHeadHtml = ''
}: HtmlShellParams): string {
  const { start, end } = htmlShellParts({ pageTitleTag, cssLinks, jsPreloads, headHtml, serializedContext, entryClient, nonce, extraHeadHtml })
  return `${start}${appHtml}${end}`
}

/** Splits the shell markup around the app content so it can be streamed. */
function htmlShellParts({
  pageTitleTag,
  cssLinks,
  jsPreloads,
  headHtml,
  serializedContext,
  entryClient,
  nonce,
  extraHeadHtml = ''
}: Omit<HtmlShellParams, 'appHtml'>): { start: string; end: string } {
  const nonceAttr = nonce ? ` nonce="${nonce}"` : ''

  const start = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${pageTitleTag}
${cssLinks}
${jsPreloads}
${headHtml}
${extraHeadHtml ? `${extraHeadHtml}\n` : ''}<script${nonceAttr}>window.__PAGE_CONTEXT__=${serializedContext}</script>
</head>
<body>
<div id="root" tabindex="-1">`

  const end = `</div>
<script type="module" src="${entryClient}"${nonceAttr}></script>
</body>
</html>`

  return { start, end }
}

interface HtmlShellStreamParams extends Omit<HtmlShellParams, 'appHtml'> {
  /**
   * The app markup, as a stream of `string` or `Uint8Array` chunks (whatever the
   * UI framework's streaming renderer produces). Framework adapters build this by
   * calling their framework's own Web Streams-based SSR API — e.g. React's
   * `renderToReadableStream` (from `react-dom/server.edge`) or Vue's
   * `renderToWebStream` (from `vue/server-renderer`).
   */
  appStream: ReadableStream<string | Uint8Array>
}

/**
 * Same document shell as {@link renderHtmlShell}, but returns a standard
 * `ReadableStream<Uint8Array>` instead of a fully-buffered `string`: the shell's
 * opening tags are enqueued immediately, the framework's app stream is piped
 * through chunk by chunk as it becomes available, and the closing tags are
 * enqueued once the app stream ends.
 *
 * Built entirely on the platform-native `ReadableStream`/`TextEncoder` globals
 * (no Node-specific stream types), so the exact same code streams correctly on
 * Node.js (18+), Deno, Bun, and Edge runtimes (Cloudflare Workers, Vercel Edge,
 * etc.) — anywhere a `Response` with a streamed body can be returned.
 */
export function renderHtmlShellStream({ appStream, ...shellParams }: HtmlShellStreamParams): ReadableStream<Uint8Array> {
  const { start, end } = htmlShellParts(shellParams)
  const encoder = new TextEncoder()

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(start))

      const reader = appStream.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          controller.enqueue(typeof value === 'string' ? encoder.encode(value) : value)
        }
      } catch (error) {
        controller.error(error)
        return
      }

      controller.enqueue(encoder.encode(end))
      controller.close()
    },
    async cancel(reason) {
      await appStream.cancel?.(reason)
    }
  })
}
