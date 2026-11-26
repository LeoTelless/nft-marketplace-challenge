/**
 * Minimal static server for `dist/`, used by the audit runner so the local measurement matches the
 * delivery: Brotli/gzip compression, the same Cache-Control headers as `vercel.json` and the SPA
 * fallback of its rewrite. With `tls` ({ key, cert }) it serves HTTP/2 over TLS (HTTP/1.1 still accepted),
 * the transport of the published environment. No dependency beyond Node.
 */
import { createServer } from 'node:http'
import { createSecureServer } from 'node:http2'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { brotliCompress, constants, gzip } from 'node:zlib'
import { promisify } from 'node:util'

const brotli = promisify(brotliCompress)
const gz = promisify(gzip)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.svg', '.txt'])

/** Same rules as the `headers` of vercel.json. */
function cacheControl(path) {
  if (path === '/mockServiceWorker.js') return 'no-cache'
  if (path.startsWith('/assets/') || path.startsWith('/fonts/')) return 'public, max-age=31536000, immutable'
  if (path.startsWith('/images/')) return 'public, max-age=604800, stale-while-revalidate=86400'
  return 'public, max-age=0, must-revalidate'
}

export function startStaticServer(root, port, { tls } = {}) {
  const cache = new Map() // path|encoding -> Buffer
  const handler = async (req, res) => {
    try {
      let path = decodeURIComponent(new URL(req.url, 'http://x').pathname)
      let file = normalize(join(root, path))
      if (!file.startsWith(root)) throw new Error('outside root')
      let info = await stat(file).catch(() => null)
      if (!info?.isFile()) {
        // SPA fallback (rewrite of vercel.json): only for paths without a file extension.
        if (extname(path)) {
          res.writeHead(404).end('Not found')
          return
        }
        path = '/index.html'
        file = join(root, 'index.html')
      }
      const ext = extname(file)
      const accept = String(req.headers['accept-encoding'] ?? '')
      const encoding = !COMPRESSIBLE.has(ext) ? null : /\bbr\b/.test(accept) ? 'br' : /\bgzip\b/.test(accept) ? 'gzip' : null
      const key = `${file}|${encoding}`
      let body = cache.get(key)
      if (!body) {
        const raw = await readFile(file)
        body =
          encoding === 'br'
            ? await brotli(raw, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } })
            : encoding === 'gzip'
              ? await gz(raw, { level: 9 })
              : raw
        cache.set(key, body)
      }
      const headers = {
        'Content-Type': TYPES[ext] ?? 'application/octet-stream',
        'Content-Length': body.length,
        'Cache-Control': cacheControl(path),
        Vary: 'Accept-Encoding',
      }
      if (encoding) headers['Content-Encoding'] = encoding
      if (path === '/mockServiceWorker.js') headers['Service-Worker-Allowed'] = '/'
      res.writeHead(200, headers).end(req.method === 'HEAD' ? undefined : body)
    } catch {
      res.writeHead(500).end('Error')
    }
  }
  const server = tls ? createSecureServer({ ...tls, allowHTTP1: true }, handler) : createServer(handler)
  return new Promise((resolve) => server.listen(port, () => resolve(server)))
}
