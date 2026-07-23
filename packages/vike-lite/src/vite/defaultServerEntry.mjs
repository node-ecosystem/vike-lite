import { renderPage } from 'vike-lite/server'
import { createServer } from 'node:http'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const clientDir = path.resolve(import.meta.dirname, '../client')
const assetsDir = path.join(clientDir, 'assets')
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8', '.map': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.webp': 'image/webp', '.avif': 'image/avif', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg',
  '.pdf': 'application/pdf', '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json'
}
const server = createServer(async (req, res) => {
  try {
    const urlObj = new URL(req.url || '/', 'http://' + (req.headers.host || 'localhost'))
    const pathname = urlObj.pathname
    let fileUrl = pathname
    const { BASE_URL } = import.meta.env
    if (BASE_URL !== '/' && pathname.startsWith(BASE_URL)) fileUrl = '/' + pathname.slice(BASE_URL.length)
    if (fileUrl !== '/') {
      const normalizedUrl = path.normalize(fileUrl)
      const filePath = path.resolve(clientDir, '.' + normalizedUrl)
      if (!filePath.startsWith(clientDir)) {
        res.statusCode = 403
        res.end('Forbidden')
        return
      }
      try {
        const stat = await fsPromises.stat(filePath)
        if (stat.isFile()) {
          const ext = path.extname(filePath).toLowerCase()
          const mimeType = MIME_TYPES[ext] || 'application/octet-stream'
          res.setHeader('Content-Type', mimeType)
          res.setHeader('Cache-Control', filePath.startsWith(assetsDir) ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate')
          fs.createReadStream(filePath).pipe(res)
          return
        }
      } catch { }
    }
    const headers = new Headers()
    for (const [key, val] of Object.entries(req.headers)) {
      if (Array.isArray(val)) for (const v of val) headers.append(key, v)
      else if (val) headers.set(key, val)
    }
    const { method } = req
    const init = { method, headers }
    if (method !== 'GET' && method !== 'HEAD') {
      init.body = Readable.toWeb(req)
      init.duplex = 'half'
    }
    const request = new Request(urlObj.href, init)
    const response = await renderPage(request)
    res.statusCode = response.status
    for (const [key, val] of response.headers) res.setHeader(key, val)
    if (method === 'HEAD' || !response.body) {
      await response.body?.cancel()
      res.end()
      return
    }
    try { await pipeline(Readable.fromWeb(response.body), res) } catch (error) { console.error('Stream error:', error) }
  } catch (error) {
    console.error('Handler error:', error)
    if (!res.headersSent) {
      res.statusCode = 500
      res.end('Internal Server Error')
    }
  }
})
const port = process.env.PORT ? Number.parseInt(process.env.PORT) : 3000
server.listen(port, () => { console.log(`\n\u{1B}[32m🚀 Server is running at http://localhost:${port}\u{1B}[0m\n`) })
