# CLAUDE.md

Guidance for Claude Code when working in this repository. This is the **root**
file covering the monorepo and the backend. The frontend has its own detailed
guide at `frontend/CLAUDE.md` — read that for anything UI-related.

## What this is

**Kantelo** — a practice coach for musicians. The repo is named
`practice-journal` for historical reasons; the product is Kantelo. The
authoritative product/spec/design docs live in `docs/`:

- `docs/kantelo-product-spec.md` — full product spec (future scope in §10);
  design intent, not build status
- `docs/kantelo-schema-api.md` — canonical DB schema + API contract
- `docs/kantelo-design-tokens.md` — design tokens (source of truth for the UI)
- `docs/kantelo-frontend-repertoire.md` — repertoire surface designs
- `docs/kantelo-frontend-plan.md` — the phased frontend rebuild plan
  (historical: Phase 0 completed July 2026)
- `docs/railway-deployment.md` — production deploy (Railway)

When a question touches schema, API shape, or design tokens, treat the relevant
doc as the source of truth over ad-hoc code reading. For **what's built vs.
planned** (status/roadmap), the docs are *not* authoritative — see "Orienting:
sources of truth" below.

## Orienting: sources of truth

Design/contract docs describe intent and shape; they deliberately do **not**
track project status. To assess current state and what's next — especially from
a fresh checkout or a parallel/cloud agent — derive it from the live sources
rather than any committed status file (there isn't one, by design — it would
rot and conflict across branches):

- **What's shipped / recent history** → `git log --oneline -20` and merged PRs:
  `gh pr list --state merged --limit 20`
- **What's in flight / open work** → `gh pr list` and `gh issue list`
- **Roadmap / prioritization (the source of truth for "what's next")** → the
  GitHub Project board: `gh project item-list <n> --owner <owner>` (needs a
  token with `read:project`; in a cloud/CI sandbox, provide it as an env var so
  `gh` can auth).
- **Conventions / architecture** → this file and `frontend/CLAUDE.md`.
- **Schema / API / tokens contracts** → the `docs/` files above.

Keep the contract docs (schema-api, design-tokens) current in the same PR that
changes the underlying model/tokens — that's the one kind of doc freshness worth
enforcing.

## Layout

```
backend/    FastAPI + SQLModel (async) + PostgreSQL + Alembic, Clerk auth
frontend/   Next.js 14 App Router + TypeScript + Tailwind, Clerk auth  (see frontend/CLAUDE.md)
docs/       Product spec, schema/API, design tokens, wireframes
docker-compose.yml   db (5432) + backend (8000) + frontend (3000)
```

## Running things

Docker Compose is the primary dev loop. See `README.md` / `QUICKSTART.md` for
the full setup; the essentials:

```bash
docker compose up --build                              # start all three services
docker compose exec backend alembic upgrade head       # run migrations (required on first run)
docker compose exec backend python scripts/seed_curated_blocks.py   # optional: global block library
docker compose logs -f backend                         # tail a service
docker compose exec db psql -U practice_user -d practice_journal     # psql into the dev DB
```

Both backend and frontend hot-reload via mounted volumes. User-owned data
(instruments, templates, pieces, logs) is created through the app after signing
in via Clerk — there is no per-user seed step.

## Tests

CI (`.github/workflows/ci.yml`) runs backend (pytest) and frontend (Vitest) on
every PR and on push to `main`. Both must pass.

**Backend** — pytest integration suite under `backend/tests/`. It needs a live
Postgres and creates/drops an isolated `practice_journal_test` database per run,
applying the **real Alembic migrations** (not `SQLModel.metadata.create_all`) so
column types, partial indexes, and FK behavior match production. Run inside the
container so the DB host resolves:

```bash
docker compose exec backend python -m pytest tests/ -v
docker compose exec backend python -m pytest tests/test_practice_api.py -v   # one file
```

`tests/conftest.py` reads `DB_HOST` (defaults to `db` inside Docker,
`localhost` otherwise) and provides the test client, async session, and data
factories. Leftover test DBs can be removed with `scripts/clean-test-dbs.sh`.

**Frontend** — `cd frontend && npm test` (Vitest). See `frontend/CLAUDE.md`.

## Backend conventions

These are easy to get wrong from code-reading alone:

- **Async everywhere.** Routers, services, and DB access are async
  (`AsyncSession`, `await session.exec(...)`). Don't introduce sync DB calls.
- **Ownership via shared helpers.** Use `app/api/ownership.py`
  (`get_owned_instrument`, `get_owned_template`, `get_owned_session`, etc.) to
  fetch user-scoped resources. They raise **404** (not 403) when a resource is
  missing, soft-deleted, or owned by another user — don't leak existence.
- **Soft delete.** Records carry `deleted_at`; "alive" queries filter
  `deleted_at == None` (`# noqa: E711` for the SQLAlchemy `== None` idiom).
  Don't hard-delete; don't forget the filter on reads.
- **Timestamps are naive UTC.** Always use `utcnow()` from `app/enums.py`
  (naive `datetime`, tzinfo stripped) — asyncpg requires naive datetimes for
  these columns and Postgres TIMESTAMPTZ treats them as UTC. Never use
  `datetime.utcnow()` or `datetime.now()` directly.
- **Auth.** Clerk JWT validated in `app/auth.py`; protected endpoints depend on
  `get_current_user` (use `get_current_user_optional` where anonymous is
  allowed). The User row is created on first authenticated API call.
- **Routers.** One router per resource in `app/api/*_api.py`, each with a
  `prefix=`, all mounted under `/api` in `app/main.py`. Enums live in
  `app/enums.py`; reusable business logic in `app/services/`; the coaching
  engine in `app/suggestions/` (rules + orchestrator).
- **Migrations.** After changing a model in `app/models/`, generate and apply:
  `docker compose exec backend alembic revision --autogenerate -m "..."` then
  `alembic upgrade head`. Review autogenerated migrations before committing —
  the test suite runs them.

## Frontend

See `frontend/CLAUDE.md` for the full guide (Next.js App Router structure, the
`createAuthenticatedAPI()` client in `src/lib/api.ts`, shared types in
`src/lib/types.ts`, the Tailwind/token system, and the dev-only `/preview`
route). Key context: the Phase-0 rebuild against the new Kantelo schema and
design system is complete (all core screens retoned to tokens/primitives, PRs
#203–#210); current work is post-Phase-0 features (Progress tab, quick-start
wizard, repertoire library, profile preferences). The Progress tab is still a
`ComingSoonPlaceholder`.

## Conventions for working here

- Match surrounding style; keep changes scoped to the task.
- Don't commit or push unless asked. Branch off `main` before committing.
- Backend and frontend each have their own `.env`; the repo root `.env` also
  feeds `NEXT_PUBLIC_*` build args into the frontend Docker build.
