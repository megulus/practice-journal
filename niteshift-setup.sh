#!/usr/bin/env bash
#
# niteshift-setup.sh — boot the Kantelo full stack in a Niteshift sandbox so an
# agent starts against a running app (Postgres + FastAPI backend + Next.js
# frontend). Mirrors the local `docker compose` dev loop, with two sandbox
# adaptations documented inline.
#
# STATUS: first draft, NOT yet validated in a live sandbox. Niteshift's setup
# agent (which can actually run it) should confirm/iterate — the most likely
# tweak points are marked `# ITERATE:` below.
#
# Required env vars come from the Niteshift *setup* scope (Settings ->
# Repositories -> Setup Script). The agent's own auth (Anthropic API key or
# Claude Code OAuth) and the agent-scope GH_TOKEN are configured separately and
# are NOT used here.
#
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

# --- Required secrets (Niteshift setup-scope env) ----------------------------
: "${CLERK_PUBLISHABLE_KEY:?set CLERK_PUBLISHABLE_KEY in the Niteshift setup-scope env}"
: "${CLERK_SECRET_KEY:?set CLERK_SECRET_KEY in the Niteshift setup-scope env}"
: "${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:?set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY in the Niteshift setup-scope env}"

# backend/.env is gitignored (absent in a fresh clone); the backend compose
# service loads it via `env_file`, so recreate it from the injected secrets.
cat > backend/.env <<EOF
CLERK_PUBLISHABLE_KEY=${CLERK_PUBLISHABLE_KEY}
CLERK_SECRET_KEY=${CLERK_SECRET_KEY}
EOF

# --- Adaptation 1: host networking -------------------------------------------
# Niteshift runs Docker with --iptables=false, so compose's bridge network and
# service-name DNS (`db`) don't work; services must share the host network and
# talk over localhost. Layer an override that (a) puts every service on host
# net and (b) repoints the backend's DATABASE_URL from `@db` to `@localhost`.
cat > docker-compose.niteshift.yml <<'YAML'
services:
  db:
    network_mode: host
  frontend:
    network_mode: host
  backend:
    network_mode: host
    environment:
      DATABASE_URL: postgresql+asyncpg://practice_user:practice_pass@localhost:5432/practice_journal
      # ITERATE: if the browser (Niteshift preview URL) hits CORS errors calling
      # the API, add that origin, e.g.
      # CORS_ORIGINS: "https://ns-3000-xxxx.preview.niteshift.dev"
YAML

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.niteshift.yml"

# --- Adaptation 2: Node version pin ------------------------------------------
# The frontend image is node:20.20.2-alpine on purpose — a newer Node
# reintroduces the dev-mode Clerk middleware EvalError (#192). Building via
# compose (its Dockerfile) preserves the pin, so we never run the frontend on
# the sandbox's Node 22. NEXT_PUBLIC_* build args interpolate from the
# setup-scope env.
$COMPOSE build backend frontend

# --- Database: up, wait for ready, migrate, (optional) seed ------------------
$COMPOSE up -d db
until $COMPOSE exec -T db pg_isready -U practice_user -d practice_journal >/dev/null 2>&1; do
  sleep 1
done
$COMPOSE run --rm backend alembic upgrade head
# Optional global block library; non-fatal if it fails.
$COMPOSE run --rm backend python scripts/seed_curated_blocks.py || true

# --- Start the app -----------------------------------------------------------
$COMPOSE up -d backend frontend
