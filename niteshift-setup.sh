#!/usr/bin/env bash
# Niteshift setup for Kantelo (megulus/practice-journal).
#
# SOURCE OF TRUTH: the copy saved in the Niteshift environment settings is what
# provisions sandboxes; this file is its version-controlled mirror, so changes
# get reviewed in a PR. When you change one, paste the same text into the other.
# Sandboxes see the environment copy at ~/.niteshift/niteshift-setup.sh.
#
# The repo's documented dev loop is `docker compose up --build` (db + backend +
# frontend). That can't be used here: this sandbox runs Docker with
# --iptables=false, so containers on a Docker bridge network can't reach each
# other or the internet. We therefore run the same three services the compose
# file defines, but adapted:
#   - postgres:17-alpine in a container with --network=host (same image/creds as
#     docker-compose.yml)
#   - backend natively: alembic upgrade head + uvicorn --reload (same commands as
#     backend/Dockerfile CMD, matching .github/workflows/ci.yml's native run)
#   - frontend natively: npm ci + npm run dev (same as the Dockerfile `dev` stage)
#
# Niteshift-specific adaptation: frontend/src/lib/api.ts calls the backend at
# an absolute NEXT_PUBLIC_API_URL rather than going through the /api/* rewrite in
# next.config.js. Pointing that at the port-8000 preview URL does NOT work: the
# preview proxy does not carry a viewer's session across preview subdomains, so
# every XHR from the port-3000 page to the port-8000 origin comes back 401 and
# the UI shows "Failed to fetch" (verified — zero /api requests ever reached the
# backend that way).
#
# Instead the API is served from the frontend's *own* origin: NEXT_PUBLIC_API_URL
# is the relative prefix /kantelo-api, `next dev` moves to an internal port, and
# a small proxy on the public port routes /kantelo-api/* to the backend and
# everything else to Next. A relative value also keeps the app working from any
# origin (preview panel, localhost, 127.0.0.1) with no rebuild.
#
# Why a prefix and not a bare relative ""? api.ts falls back to
# http://localhost:8000 on an empty value, and next.config.js interpolates the
# same variable into its rewrite destination, which Next rejects at startup
# unless it starts with "/", "http://" or "https://" ("Invalid rewrite found").
# "/kantelo-api" satisfies both.
#
# Idempotent: re-running reuses the postgres container, the venv, and
# node_modules unless the corresponding lockfile changed (backend/requirements.txt;
# the root package-lock.json, or frontend/package-lock.json on pre-#339 branches).

set -euo pipefail

REPO_ROOT="${NITESHIFT_REPO_ROOT:-$PWD}"
if [ ! -f "${REPO_ROOT}/docker-compose.yml" ] && [ -f /root/practice-journal/docker-compose.yml ]; then
  REPO_ROOT=/root/practice-journal
fi
cd "${REPO_ROOT}"

VENV_DIR=/root/.cache/kantelo-venv          # outside the repo: keeps the tree clean
STATE_DIR=/root/.cache/kantelo-setup
BACKEND_PORT=8000
FRONTEND_PORT=3000            # public port: the proxy below
NEXT_PORT=3001                # `next dev` listens here, behind the proxy
API_PREFIX_PATH=/kantelo-api  # same-origin path the browser uses for API calls
PG_CONTAINER=kantelo-postgres
PG_IMAGE=postgres:17-alpine

mkdir -p "${STATE_DIR}"

log() { echo "[kantelo-setup] $*"; }
die() { echo "[kantelo-setup] ERROR: $*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Preview URLs
# ---------------------------------------------------------------------------
# Niteshift injects NITESHIFT_PORT_<port>_URL for every registered preview port.
# Fall back to deriving the URL from any other injected port URL (they only
# differ by the port segment: https://ns-<port>-<id>.preview.niteshift.dev), so
# this keeps working if a port hasn't been registered yet.
preview_url_for_port() {
  local port="$1" var val any
  var="NITESHIFT_PORT_${port}_URL"
  val="${!var:-}"
  if [ -n "${val}" ]; then echo "${val}"; return; fi
  any="$(env | grep -E '^NITESHIFT_PORT_[0-9]+_URL=' | head -1 | cut -d= -f2- || true)"
  if [ -n "${any}" ]; then
    echo "${any}" | sed -E "s#//ns-[0-9]+-#//ns-${port}-#"
    return
  fi
  echo "http://localhost:${port}"
}

FRONTEND_PREVIEW_URL="$(preview_url_for_port "${FRONTEND_PORT}")"
BACKEND_PREVIEW_URL="$(preview_url_for_port "${BACKEND_PORT}")"

# Same-origin API base (see the header comment). Relative, so it works from the
# preview panel, http://localhost:3000 and 127.0.0.1 alike.
export NEXT_PUBLIC_API_URL="${API_PREFIX_PATH}"
# Browser calls are same-origin now, so CORS is not in play for the app itself;
# this list only matters for anything hitting :8000 directly (curl, Swagger UI).
export CORS_ORIGINS="${FRONTEND_PREVIEW_URL},${BACKEND_PREVIEW_URL},http://localhost:${FRONTEND_PORT},http://127.0.0.1:${FRONTEND_PORT}"

log "frontend preview: ${FRONTEND_PREVIEW_URL}"
log "backend  preview: ${BACKEND_PREVIEW_URL}"

# ---------------------------------------------------------------------------
# Clerk sanity check (auth is mandatory — there is no dev bypass in this app)
# ---------------------------------------------------------------------------
if [ -z "${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:-}" ] || [ -z "${CLERK_SECRET_KEY:-}" ]; then
  die "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY must be set (Clerk protects every route)"
fi
# The backend derives Clerk's JWKS URL + issuer from the publishable key.
export CLERK_PUBLISHABLE_KEY="${CLERK_PUBLISHABLE_KEY:-$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}"

# ---------------------------------------------------------------------------
# 1. PostgreSQL (the app's only infrastructure dependency)
# ---------------------------------------------------------------------------
export DATABASE_URL="${DATABASE_URL:-postgresql+asyncpg://practice_user:practice_pass@localhost:5432/practice_journal}"

if [ "$(docker inspect -f '{{.State.Running}}' "${PG_CONTAINER}" 2>/dev/null || echo missing)" = "true" ]; then
  log "postgres container already running"
else
  docker rm -f "${PG_CONTAINER}" >/dev/null 2>&1 || true
  log "starting ${PG_IMAGE} (--network=host; Docker bridge networking is unusable here)"
  docker run -d --name "${PG_CONTAINER}" --network=host --restart unless-stopped \
    -e POSTGRES_USER="${POSTGRES_USER:-practice_user}" \
    -e POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-practice_pass}" \
    -e POSTGRES_DB="${POSTGRES_DB:-practice_journal}" \
    -v kantelo_postgres_data:/var/lib/postgresql/data \
    "${PG_IMAGE}" >/dev/null
fi

log "waiting for postgres..."
for i in $(seq 1 60); do
  if docker exec "${PG_CONTAINER}" pg_isready -U "${POSTGRES_USER:-practice_user}" -d "${POSTGRES_DB:-practice_journal}" >/dev/null 2>&1; then
    log "postgres ready (${i}s)"
    break
  fi
  [ "${i}" -eq 60 ] && die "postgres did not become ready in 60s"
  sleep 1
done

# ---------------------------------------------------------------------------
# 2. Backend dependencies (backend/requirements.txt)
# ---------------------------------------------------------------------------
REQ_HASH="$(sha256sum backend/requirements.txt | cut -d' ' -f1)"
if [ ! -x "${VENV_DIR}/bin/python" ] || [ "$(cat "${STATE_DIR}/requirements.sha256" 2>/dev/null || true)" != "${REQ_HASH}" ]; then
  log "installing backend dependencies"
  if command -v uv >/dev/null 2>&1; then
    uv venv "${VENV_DIR}" >/dev/null
    VIRTUAL_ENV="${VENV_DIR}" uv pip install -q -r backend/requirements.txt
  else
    python3 -m venv "${VENV_DIR}"
    "${VENV_DIR}/bin/pip" install -q --upgrade pip
    "${VENV_DIR}/bin/pip" install -q -r backend/requirements.txt
  fi
  echo "${REQ_HASH}" > "${STATE_DIR}/requirements.sha256"
else
  log "backend dependencies up to date"
fi

# ---------------------------------------------------------------------------
# 3. Migrations + optional curated-block seed
#    (README steps 2/3, run natively instead of via `docker compose exec`)
# ---------------------------------------------------------------------------
log "running alembic migrations"
( cd backend && "${VENV_DIR}/bin/alembic" upgrade head ) || die "alembic upgrade head failed"

# The README's `python scripts/seed_curated_blocks.py` fails outside the
# container (the script's own dir lands on sys.path, so `app` isn't importable);
# the module form works. The script no-ops if the table is already populated.
log "seeding curated block library (idempotent)"
( cd backend && PYTHONPATH=. ENVIRONMENT=quiet "${VENV_DIR}/bin/python" -m scripts.seed_curated_blocks 2>&1 | tail -1 ) || \
  log "WARNING: curated block seed failed (non-fatal; the block library UI will be empty)"

# ---------------------------------------------------------------------------
# 4. Frontend dependencies
# ---------------------------------------------------------------------------
# Since #339 the repo root is an npm workspace: one lockfile at the root, and
# everything hoists into the root node_modules. Branches cut before #339 still
# have the old layout (lockfile + node_modules under frontend/), so detect it
# rather than assume it. `npm run dev` below still runs from frontend/ either
# way; Node resolves the hoisted packages by walking up the tree.
if [ -f package-lock.json ]; then
  LOCK_FILE=package-lock.json; NM_DIR=node_modules; INSTALL_DIR=.
else
  LOCK_FILE=frontend/package-lock.json; NM_DIR=frontend/node_modules; INSTALL_DIR=frontend
fi
LOCK_HASH="$(sha256sum "${LOCK_FILE}" | cut -d' ' -f1)"
if [ ! -d "${NM_DIR}" ] || [ "$(cat "${STATE_DIR}/package-lock.sha256" 2>/dev/null || true)" != "${LOCK_HASH}" ]; then
  # Switching layouts (e.g. a sandbox resumed onto a post-#339 main) leaves
  # the old frontend/node_modules behind, and it would shadow the hoisted
  # install. Clear it before every install; npm ci recreates whatever it needs.
  if [ "${INSTALL_DIR}" = "." ]; then rm -rf frontend/node_modules; fi
  log "installing frontend dependencies (npm ci in ${INSTALL_DIR}, lockfile ${LOCK_FILE})"
  ( cd "${INSTALL_DIR}" && npm ci --no-audit --no-fund ) || die "npm ci failed"
  echo "${LOCK_HASH}" > "${STATE_DIR}/package-lock.sha256"
else
  log "frontend dependencies up to date"
fi

# ---------------------------------------------------------------------------
# 5. Start the backend (uvicorn --reload, same as docker-compose's command)
# ---------------------------------------------------------------------------
# Kill anything left from a previous run so the ports are free.
for pat in "uvicorn app.main:app" "next dev" "next-server" "kantelo-proxy.js"; do
  pkill -f "${pat}" >/dev/null 2>&1 || true
done
sleep 1

log "starting backend on :${BACKEND_PORT}"
( cd backend && exec "${VENV_DIR}/bin/uvicorn" app.main:app \
    --host 0.0.0.0 --port "${BACKEND_PORT}" --reload ) &
BACKEND_PID=$!

log "waiting for backend health..."
for i in $(seq 1 60); do
  if curl -fsS -m 2 "http://localhost:${BACKEND_PORT}/health" >/dev/null 2>&1; then
    log "backend healthy (${i}s): http://localhost:${BACKEND_PORT}/docs"
    break
  fi
  kill -0 "${BACKEND_PID}" 2>/dev/null || die "backend process exited during startup"
  [ "${i}" -eq 60 ] && die "backend did not become healthy in 60s"
  sleep 1
done

# ---------------------------------------------------------------------------
# 6. Start the frontend (next dev — hot reload) on the internal port
# ---------------------------------------------------------------------------
log "starting frontend on :${NEXT_PORT} (NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL})"
# No --hostname: pinning it to 127.0.0.1 makes `localhost` resolve to ::1 for
# clients (and for Next's own internal self-proxy), which refuses connections.
( cd frontend && exec npm run dev -- --port "${NEXT_PORT}" ) &
FRONTEND_PID=$!

# ---------------------------------------------------------------------------
# 7. Front proxy on the public port: ${API_PREFIX_PATH}/* -> backend, rest -> Next
# ---------------------------------------------------------------------------
# Written at runtime and kept outside the repo so the working tree stays clean.
cat > "${STATE_DIR}/kantelo-proxy.js" <<'PROXY_EOF'
const http = require('http')

const LISTEN_PORT = Number(process.env.PROXY_PORT || 3000)
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
// redirects for an https preview origin. (An earlier "Failed to proxy
// https://localhost:3001/" was the --hostname pin below, not these headers.)
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
PROXY_EOF

log "starting front proxy on :${FRONTEND_PORT}"
PROXY_PORT="${FRONTEND_PORT}" NEXT_PORT="${NEXT_PORT}" API_PORT="${BACKEND_PORT}" \
  API_PREFIX_PATH="${API_PREFIX_PATH}" node "${STATE_DIR}/kantelo-proxy.js" &
PROXY_PID=$!

log "waiting for frontend..."
for i in $(seq 1 120); do
  if curl -fsS -m 3 -o /dev/null "http://localhost:${FRONTEND_PORT}/sign-in"; then
    log "frontend ready (${i}s): http://localhost:${FRONTEND_PORT}"
    break
  fi
  [ "${i}" -eq 120 ] && die "frontend did not respond on :${FRONTEND_PORT} in 120s"
  sleep 1
done

# ---------------------------------------------------------------------------
# 8. Supervise
# ---------------------------------------------------------------------------
# ns-helper restarts this script whenever it exits 0, so stay in the foreground
# and exit as soon as *either* service dies — otherwise a crashed backend would
# leave the frontend up with every API call failing, and nothing would notice.
wait -n
log "a service exited; shutting down so ns-helper restarts the environment"
kill "${BACKEND_PID}" "${FRONTEND_PID}" "${PROXY_PID}" >/dev/null 2>&1 || true
exit 0
