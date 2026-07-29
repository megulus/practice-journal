# ADR-0008 — Docker Compose for dev, Railway for prod

- **Status:** Accepted
- **Date:** Reconstructed 2026-07-28 (original decision predates this record)

## Context

The app is three services (Postgres, FastAPI backend, Next.js frontend) that need
to run together locally with a low-friction setup, and to deploy somewhere with
minimal ops overhead for a solo/small project.

## Decision

**Docker Compose** as the primary dev loop (`db` on 5432, `backend` on 8000,
`frontend` on 3000, with hot-reload via mounted volumes). **Railway** for
production deploy, with `alembic upgrade head` run automatically on backend
deploy.

## Rationale

- One command (`docker compose up`) brings up the whole stack; dev Postgres
  matches prod Postgres (ADR-0003), avoiding "works on my machine" schema drift.
- Mounted volumes give hot-reload for both services without rebuilds.
- Railway is low-config PaaS: managed Postgres, auto-detected builds, env-var
  management — appropriate for the project's scale, minimal ops.

## Alternatives considered

- **Local native installs (no Docker)** — faster raw startup, but environment
  drift and manual Postgres setup. *(Reconstructed.)*
- **Heavier orchestration / cloud (k8s, AWS ECS)** — overkill for the scale;
  more ops than the project warrants. *(Reconstructed.)*

## Consequences

- Backend tests and one-offs run **inside the backend container** so the DB host
  (`db`) resolves.
- A subtle gotcha: adding a new frontend npm dep requires installing it *in the
  container* and restarting the frontend service — a host-only `npm install`
  doesn't update the container's `node_modules`.
- `NEXT_PUBLIC_*` vars are build-time inlined, so they're passed as Docker build
  args (repo-root `.env` feeds the frontend build); prod deploy details live in
  `docs/railway-deployment.md`.
