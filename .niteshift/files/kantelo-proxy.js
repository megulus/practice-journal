// Front proxy for the Kantelo preview: /kantelo-api/* goes to the backend
// (prefix stripped), everything else to `next dev`. See services.yaml.
const http = require('http')

const LISTEN_PORT = Number(process.env.PORT || 3000)
const NEXT_PORT = Number(process.env.NEXT_PORT || 3001)
const API_PORT = Number(process.env.API_PORT || 8000)
const API_PREFIX = process.env.API_PREFIX_PATH || '/kantelo-api'

// Strip the prefix off API calls; everything else goes to `next dev` untouched.
const routeFor = (url) => {
  if (url === API_PREFIX || url.startsWith(`${API_PREFIX}/`)) {
    return { port: API_PORT, path: url.slice(API_PREFIX.length) || '/' }
  }
  return { port: NEXT_PORT, path: url }
}

// Headers pass through untouched, x-forwarded-* included: Clerk builds its
// handshake redirect URLs from them, so dropping them would produce http://
// redirects for an https preview origin.
const server = http.createServer((req, res) => {
  const { port, path } = routeFor(req.url)
  const upstream = http.request(
    { host: '127.0.0.1', port, path, method: req.method, headers: req.headers },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode, upstreamRes.headers)
      upstreamRes.pipe(res)
    }
  )
  upstream.on('error', (err) => {
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain' })
    res.end(`proxy error contacting 127.0.0.1:${port}: ${err.message}`)
  })
  req.pipe(upstream)
})

// Next dev's HMR runs over a WebSocket; without this, hot reload silently dies.
server.on('upgrade', (req, socket, head) => {
  const { port, path } = routeFor(req.url)
  const upstream = http.request({
    host: '127.0.0.1',
    port,
    path,
    method: req.method,
    headers: req.headers,
  })
  upstream.on('upgrade', (upstreamRes, upstreamSocket, upstreamHead) => {
    const headers = Object.entries(upstreamRes.headers)
      .map(([k, v]) => `${k}: ${v}\r\n`)
      .join('')
    socket.write(`HTTP/1.1 101 Switching Protocols\r\n${headers}\r\n`)
    if (upstreamHead && upstreamHead.length) upstreamSocket.unshift(upstreamHead)
    upstreamSocket.pipe(socket)
    socket.pipe(upstreamSocket)
    upstreamSocket.on('error', () => socket.destroy())
    socket.on('error', () => upstreamSocket.destroy())
  })
  upstream.on('error', () => socket.destroy())
  if (head && head.length) upstream.write(head)
  upstream.end()
})

server.listen(LISTEN_PORT, '0.0.0.0', () => {
  console.log(
    `[kantelo-proxy] :${LISTEN_PORT} -> next :${NEXT_PORT}, ${API_PREFIX}/* -> backend :${API_PORT}`
  )
})
