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
- `docs/kantelo-frontend-phase-0-plan.md` — the Phase 0 frontend rebuild plan
  (historical: Phase 0 completed July 2026; there is no active plan doc)
- `docs/railway-deployment.md` — production deploy (Railway)
- `docs/adr/` — architecture decision records (why the stack/schema choices were
  made); reconstructed set, see `docs/adr/README.md`

When a question touches schema, API shape, or design tokens, treat the relevant
doc as the source of truth over ad-hoc code reading. For **what's built vs.
planned** (status/roadmap), the docs are *not* authoritative — see "Orienting:
sources of truth" below.

## Orienting: sources of truth

> **Already dispatched on a specific ticket?** (e.g. a Niteshift run launched from
> an issue, or you were told "work on #N.") Then that ticket **is** your task —
> read the issue and its linked docs/PRs and get to work; **skip the "what's next"
> roadmap query below.** The roadmap query is only for when you need to *choose*
> what to work on, not when the work has already been chosen for you.

Design/contract docs describe intent and shape; they deliberately do **not**
track project status. To assess current state and what's next — especially from
a fresh checkout or a parallel/cloud agent — derive it from the live sources
rather than any committed status file (there isn't one, by design — it would
rot and conflict across branches):

- **What's shipped / recent history** → `git log --oneline -20` and merged PRs:
  `gh pr list --state merged --limit 20`
- **What's in flight / open work** → `gh pr list` and `gh issue list --state open
  --limit 100` (to focus one workstream add `--label <name>`; discover the active
  labels with `gh label list`)
- **Roadmap / prioritization (the source of truth for "what's next")** → the
  GitHub Project board (Kantelo board is project `2`, owner `megulus`). The
  **`Ready` column is the curated next-up queue — start there** to answer "what
  should I pick up?"; `Backlog` is everything not yet promoted, `Done` is shipped.
  **Agents: skip any `Ready` item labeled `human-only`** — those need a person
  (dashboard access, secret rotation, etc.), not an agent.
  The Ready column is label-agnostic, so it stays the "what's next" signal no
  matter which workstream is active. For structure/sequence, find the current
  epic(s) via `gh issue list --label epic --state open` — as of 2026-07 the active
  one is **#141** (the frontend rebuild), but verify it's still current and watch
  for others (workstream labels like `frontend-rebuild` eventually retire). Treat
  an epic's checklist as a lagging indicator; the board columns are authoritative
  for status. Reading the board needs **`GH_PROJECT_TOKEN`** (see below), and it
  needs paging — the board is ~134 items and **every paged API truncates
  silently** (`gh project item-list` stops at 30 by default; GraphQL caps a page
  at 100), which will hide most of the board:
  ```bash
  # GH_PROJECT_TOKEN has the `project` scope but not `read:org`, which every
  # `gh project ...` subcommand requires — so query GraphQL directly.
  # In Niteshift sandboxes /usr/local/bin/gh is a wrapper that re-exports
  # GH_TOKEN; call /usr/bin/gh there so the prefix below actually sticks.
  cursor=null
  while :; do
    r=$(GH_TOKEN=$GH_PROJECT_TOKEN gh api graphql -f query="query{ user(login:\"megulus\"){
          projectV2(number:2){ items(first:100, after:$cursor){
            pageInfo{ hasNextPage endCursor }
            nodes{ content{ ... on Issue{ number title } ... on PullRequest{ number title } }
                   fieldValueByName(name:\"Status\"){
                     ... on ProjectV2ItemFieldSingleSelectValue{ name } } } } } } }")
    echo "$r" | jq -r '.data.user.projectV2.items.nodes[] | select(.content.number != null)
      | "\(.fieldValueByName.name // "-")\t#\(.content.number)\t\(.content.title)"'
    [ "$(jq -r '.data.user.projectV2.items.pageInfo.hasNextPage' <<<"$r")" = true ] || break
    cursor="\"$(jq -r '.data.user.projectV2.items.pageInfo.endCursor' <<<"$r")\""
  done | sort
  ```
  `GH_PROJECT_TOKEN` exists purely for board queries. **Never export it as
  `GH_TOKEN` or otherwise let it replace the default token** — `GH_TOKEN` is the
  sandbox's GitHub App token that handles git, PRs, and issues, and swapping it
  breaks commit/PR attribution. Prefix the one command, as above. The default
  `GH_TOKEN` carries no Projects permission and fails board queries with
  `Resource not accessible by integration (user.projectV2)`; that error means the
  wrong token, not a missing board. If `GH_PROJECT_TOKEN` is unset you simply
  cannot see the board — fall back to `git log`, `gh pr list`, and `gh issue list
  --state open`, and **say that board status was unavailable** instead of guessing
  which column something sits in.
- **Conventions / architecture** → this file and `frontend/CLAUDE.md`.
- **Schema / API / tokens contracts** → the `docs/` files above.

Keep the contract docs (schema-api, design-tokens) current in the same PR that
changes the underlying model/tokens — that's the one kind of doc freshness worth
enforcing.

## Grooming the backlog

Grooming is a distinct task from picking up work: you're *maintaining the tracker
to match reality*, which means mutating issues and board items — so it is
**propose-then-confirm, never autonomous**. Produce a triage report and let a
human approve the actual closes/edits/moves. Do not close, edit, or re-status
tickets directly unless explicitly told to; closing an issue is outward-facing
and awkward to reverse.

Procedure:

1. **Load the whole backlog** — run the paged board query from "Orienting" above
   (paging is mandatory; a single default page silently truncates and you'll
   groom a fraction thinking you're done). Filter to `Backlog`.
2. **Diff each ticket against current reality** — the highest-value move is
   catching tickets *silently resolved or overtaken* by shipped work. Don't lean on
   a fixed recent-PR window; grooming targets *old* stragglers a recent window
   would miss. Check **per ticket**: search for its number in merged PRs and
   commits (`gh pr list --search <NNN> --state merged`, `git log --grep '#<NNN>'`),
   and look for the feature directly in the code and `docs/`. A ticket describing
   something already built or changed is a close/rescope candidate.
3. **Classify** each into: `close` (done/overtaken/won't-do), `dedupe` (links to
   another), `rescope` (drifted or unclear acceptance criteria), `promote` (belongs
   in `Ready`), or `keep` (still valid, stays in Backlog). Give a one-line reason
   and cite the evidence (commit/PR/doc).
4. **Output a report, then stop.** Group by classification with the reasons. The
   human reviews and says which to action; only then make the changes.

Board writes (status moves) need write access to the project. `GH_PROJECT_TOKEN`
carries the full `project` scope (read **and** write, not just `read:project`),
so it should permit moves — but that has deliberately never been exercised, and
`gh project item-edit` is unusable with it anyway (missing `read:org`), so a move
means a hand-written GraphQL mutation. Don't make one without explicit sign-off;
closing issues needs repo write. Known groom candidates as of this
writing: **#80** (docs consolidation — largely overtaken by the docs refresh +
ADRs), **#156** (reconcile schema-api — addressed by that same work), **#33**
(ancient, needs rethink).

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
