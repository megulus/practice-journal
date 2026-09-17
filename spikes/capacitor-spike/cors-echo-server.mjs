/**
 * Device run-book tool (Phase D1). Answers one question the sandbox cannot:
 * **what Origin header does WKWebView actually send** from a Capacitor app?
 *
 * Run it on the Mac, point the harness at http://<mac-lan-ip>:8787, tap
 * "GET /__echo" on the phone, and read the Origin off both the phone screen
 * and this server's stdout.
 *
 *   node cors-echo-server.mjs               # echoes back the request Origin (permissive)
 *   node cors-echo-server.mjs --deny        # sends no CORS headers at all (reproduces the failure)
 *   node cors-echo-server.mjs --allow capacitor://localhost   # allow-list exactly one origin
 *
 * Nothing here is Kantelo code; it is a 40-line mirror.
 */
import { createServer } from 'node:http'

const args = process.argv.slice(2)
const deny = args.includes('--deny')
const allowIdx = args.indexOf('--allow')
const allowOnly = allowIdx >= 0 ? args[allowIdx + 1] : null
const port = Number(process.env.PORT ?? 8787)

createServer((req, res) => {
  const origin = req.headers.origin ?? '(none)'
  console.log(`\n${req.method} ${req.url}`)
  console.log(`  Origin:        ${origin}`)
  console.log(`  Authorization: ${req.headers.authorization ? 'Bearer …' + String(req.headers.authorization).slice(-8) : '(none)'}`)
  console.log(`  Cookie:        ${req.headers.cookie ?? '(none)'}`)
  console.log(`  User-Agent:    ${req.headers['user-agent'] ?? '(none)'}`)

  const headers = { 'Content-Type': 'application/json' }
  if (!deny) {
    const allowed = allowOnly ? allowOnly === origin : true
    if (allowed && origin !== '(none)') {
      headers['Access-Control-Allow-Origin'] = origin
      headers['Access-Control-Allow-Credentials'] = 'true'
      headers['Vary'] = 'Origin'
    }
    headers['Access-Control-Allow-Headers'] = 'authorization, content-type'
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers)
    res.end()
    return
  }
  res.writeHead(200, headers)
  res.end(JSON.stringify({ sawOrigin: origin, sawAuthorization: Boolean(req.headers.authorization), sawCookie: req.headers.cookie ?? null, mode: deny ? 'deny' : allowOnly ? `allow:${allowOnly}` : 'echo' }, null, 2))
}).listen(port, '0.0.0.0', () =>
  console.log(`cors-echo-server on http://0.0.0.0:${port}  (mode: ${deny ? 'deny' : allowOnly ? `allow ${allowOnly}` : 'echo any origin'})`),
)
