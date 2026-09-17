# Phase D1 — CORS probes against the live Kantelo backend

Backend: the real app running in this sandbox (uvicorn app.main:app, port 8000),
unmodified, with its default CORS_ORIGINS=http://localhost:3000.
starlette 0.35.1 / fastapi 0.109.0.

## As shipped today (CORS_ORIGINS=http://localhost:3000)

### webview origin, iOS default scheme — Origin: capacitor://localhost
```
$ curl -i -X OPTIONS http://localhost:8000/api/user/me -H 'Origin: capacitor://localhost' -H 'Access-Control-Request-Method: GET' -H 'Access-Control-Request-Headers: authorization'
HTTP/1.1 400 Bad Request
vary: Origin
access-control-allow-methods: DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT
access-control-max-age: 600
access-control-allow-credentials: true
access-control-allow-headers: authorization
content-length: 22
content-type: text/plain; charset=utf-8

Disallowed CORS origin

$ curl -i http://localhost:8000/api/user/me -H 'Origin: capacitor://localhost' -H 'Authorization: Bearer <clerk jwt>'
HTTP/1.1 401 Unauthorized
content-length: 121
content-type: application/json
access-control-allow-credentials: true
access-control-expose-headers: Idempotent-Replay

{"detail":"Invalid token: Invalid header string: 'utf-8' codec can't decode byte 0x8a in position 0: invalid start byte"}
```

### webview origin, iosScheme: https — Origin: https://localhost
```
$ curl -i -X OPTIONS http://localhost:8000/api/user/me -H 'Origin: https://localhost' -H 'Access-Control-Request-Method: GET' -H 'Access-Control-Request-Headers: authorization'
HTTP/1.1 400 Bad Request
vary: Origin
access-control-allow-methods: DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT
access-control-max-age: 600
access-control-allow-credentials: true
access-control-allow-headers: authorization
content-length: 22
content-type: text/plain; charset=utf-8

Disallowed CORS origin

$ curl -i http://localhost:8000/api/user/me -H 'Origin: https://localhost' -H 'Authorization: Bearer <clerk jwt>'
HTTP/1.1 401 Unauthorized
content-length: 121
content-type: application/json
access-control-allow-credentials: true
access-control-expose-headers: Idempotent-Replay

{"detail":"Invalid token: Invalid header string: 'utf-8' codec can't decode byte 0x8a in position 0: invalid start byte"}
```

### opaque origin (what a browser sends when the origin is not serialisable) — Origin: null
```
$ curl -i -X OPTIONS http://localhost:8000/api/user/me -H 'Origin: null' -H 'Access-Control-Request-Method: GET' -H 'Access-Control-Request-Headers: authorization'
HTTP/1.1 400 Bad Request
vary: Origin
access-control-allow-methods: DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT
access-control-max-age: 600
access-control-allow-credentials: true
access-control-allow-headers: authorization
content-length: 22
content-type: text/plain; charset=utf-8

Disallowed CORS origin

$ curl -i http://localhost:8000/api/user/me -H 'Origin: null' -H 'Authorization: Bearer <clerk jwt>'
HTTP/1.1 401 Unauthorized
content-length: 121
content-type: application/json
access-control-allow-credentials: true
access-control-expose-headers: Idempotent-Replay

{"detail":"Invalid token: Invalid header string: 'utf-8' codec can't decode byte 0x8a in position 0: invalid start byte"}
```

### the allowed web origin, for contrast — Origin: http://localhost:3000
```
$ curl -i -X OPTIONS http://localhost:8000/api/user/me -H 'Origin: http://localhost:3000' -H 'Access-Control-Request-Method: GET' -H 'Access-Control-Request-Headers: authorization'
HTTP/1.1 200 OK
vary: Origin
access-control-allow-methods: DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT
access-control-max-age: 600
access-control-allow-credentials: true
access-control-allow-origin: http://localhost:3000
access-control-allow-headers: authorization
content-length: 2
content-type: text/plain; charset=utf-8


$ curl -i http://localhost:8000/api/user/me -H 'Origin: http://localhost:3000' -H 'Authorization: Bearer <clerk jwt>'
HTTP/1.1 401 Unauthorized
content-length: 121
content-type: application/json
access-control-allow-credentials: true
access-control-expose-headers: Idempotent-Replay
access-control-allow-origin: http://localhost:3000
vary: Origin

{"detail":"Invalid token: Invalid header string: 'utf-8' codec can't decode byte 0x8a in position 0: invalid start byte"}
```

## With CORS_ORIGINS="http://localhost:3000,capacitor://localhost,http://localhost:3200"

Same unmodified app, second uvicorn on :8001, env var only.

### webview origin now allow-listed — Origin: capacitor://localhost
```
$ curl -i -X OPTIONS http://localhost:8001/api/user/me -H 'Origin: capacitor://localhost' -H 'Access-Control-Request-Method: GET' -H 'Access-Control-Request-Headers: authorization'
HTTP/1.1 200 OK
vary: Origin
access-control-allow-methods: DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT
access-control-max-age: 600
access-control-allow-credentials: true
access-control-allow-origin: capacitor://localhost
access-control-allow-headers: authorization
content-length: 2
content-type: text/plain; charset=utf-8


$ curl -i http://localhost:8001/api/user/me -H 'Origin: capacitor://localhost' -H 'Authorization: Bearer …'
HTTP/1.1 401 Unauthorized
content-length: 121
content-type: application/json
access-control-allow-credentials: true
access-control-expose-headers: Idempotent-Replay
access-control-allow-origin: capacitor://localhost
vary: Origin

```

## With CORS_ORIGINS="*" (third uvicorn on :8002) — the lazy fix, and why not to take it

### wildcard + allow_credentials=True — Origin: capacitor://localhost
```
$ curl -i -X OPTIONS http://localhost:8002/api/user/me -H 'Origin: capacitor://localhost' -H 'Access-Control-Request-Method: GET' -H 'Access-Control-Request-Headers: authorization'
HTTP/1.1 200 OK
vary: Origin
access-control-allow-methods: DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT
access-control-max-age: 600
access-control-allow-credentials: true
access-control-allow-origin: capacitor://localhost
access-control-allow-headers: authorization
content-length: 2
content-type: text/plain; charset=utf-8


$ curl -i http://localhost:8002/api/user/me -H 'Origin: capacitor://localhost' -H 'Authorization: Bearer …'
HTTP/1.1 401 Unauthorized
content-length: 121
content-type: application/json
access-control-allow-origin: *
access-control-allow-credentials: true
access-control-expose-headers: Idempotent-Replay

{"detail":"Invalid token: Invalid header string: 'utf-8' codec can't decode byte 0x8a in position 0: invalid start byte"}
```

Note the combination on the simple response: `access-control-allow-origin: *` **and**
`access-control-allow-credentials: true`. A browser rejects that pair for any request made
with `credentials: 'include'`. Kantelo's client sends a Bearer header and no cookies
(frontend/src/lib/api.ts), so it would survive — but it is one `credentials: 'include'`
away from breaking, and it opens the API to every origin.
