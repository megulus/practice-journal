/**
 * A local HTTP server that resolves paths the way Capacitor's iOS webview
 * does, so routing behaviour can be observed without a Mac.
 *
 * Transcribed from node_modules/@capacitor/ios/Capacitor/Capacitor/Router.swift
 * (CapacitorRouter.route(for:)):
 *
 *     if pathUrl.pathExtension.isEmpty { return basePath + "/index.html" }
 *     return basePath + path
 *
 * i.e. ANY extensionless path — /thing/1, /protected, /anything/at/all — is
 * served the root index.html. There is no .html fallback and no 404.
 *
 * This is NOT the webview: no capacitor:// origin, no WKWebView engine. It
 * isolates one variable — path resolution — and nothing else.
 *
 *   node capacitor-router-sim.mjs [port] [webDir]
 */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

const port = Number(process.argv[2] ?? 3200)
const basePath = process.argv[3] ?? 'out'

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.txt': 'text/plain', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
}

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  const ext = extname(path)
  const file = ext === '' ? join(basePath, 'index.html') : join(basePath, normalize(path))
  try {
    const body = await readFile(file)
    res.writeHead(200, { 'Content-Type': MIME[ext || '.html'] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' })
    res.end(body)
    console.log(`200 ${path} -> ${file}`)
  } catch {
    // Capacitor's handler calls didFailWithError here; a load error, not a 404 page.
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('scheme task failed (file not found)')
    console.log(`404 ${path} -> ${file}  [MISSING]`)
  }
}).listen(port, () => console.log(`capacitor-router-sim on http://localhost:${port} serving ${basePath}/`))
