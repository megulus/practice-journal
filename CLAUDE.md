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
  should I pick up?"; `Backlog` is everything not yet promoted, `Done` is shipped,
  and `Closed` is won't-do / obsolete / superseded (kept distinct from `Done` so
  shipped work stays separate from things we consciously dropped).
  **Agents: skip any `Ready` item labeled `human-only`** — those need a person
  (dashboard access, secret rotation, etc.), not an agent.
  The Ready column is label-agnostic, so it stays the "what's next" signal no
  matter which workstream is active. For structure/sequence, find the current
  epic(s) via `gh issue list --label epic --state open` — as of 2026-07 the active
  one is **#141** (the frontend rebuild), but verify it's still current and watch
  for others (workstream labels like `frontend-rebuild` eventually retire). Treat
  an epic's checklist as a lagging indicator; the board columns are authoritative
  for status. Reading the board needs **`GH_PROJECT_TOKEN`** (see below), and it
  needs paging — the board is ~140 items and **every paged API truncates
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

Board writes (adding an item, moving a column) do work with `GH_PROJECT_TOKEN` —
verified 2026-08 by adding #254–#257 to `Backlog`. `gh project item-add` /
`item-edit` are still unusable with it (missing `read:org`), so a write means a
hand-written GraphQL mutation. **This stays propose-then-confirm: don't write to
the board without explicit sign-off.** Adding an issue is two mutations — fetch
its `node_id` with `gh api repos/megulus/practice-journal/issues/<N> --jq
.node_id`, then:

```bash
# 1. add to the board (returns the new item id)
GH_TOKEN=$GH_PROJECT_TOKEN /usr/bin/gh api graphql -f query='mutation{
  addProjectV2ItemById(input:{ projectId:"PVT_kwHOAJTkl84BO2cV",
                               contentId:"<issue node_id>" }){ item{ id } } }'
# 2. set its Status column
GH_TOKEN=$GH_PROJECT_TOKEN /usr/bin/gh api graphql -f query='mutation{
  updateProjectV2ItemFieldValue(input:{ projectId:"PVT_kwHOAJTkl84BO2cV",
    itemId:"<item id>", fieldId:"PVTSSF_lAHOAJTkl84BO2cVzg9bnc4",
    value:{ singleSelectOptionId:"f75ad846" } }){ projectV2Item{ id } } }'
```

Status option ids: `Backlog` `f75ad846`, `Ready` `61e4505c`, `In progress`
`47fc9ee4`, `Done` `98236657`, `Closed` `d5b06b84` (the `In review` column was
removed 2026-08). Re-derive them if the
board is ever restructured by querying `fields(first:20)` for
`ProjectV2SingleSelectField`. Closing issues needs repo write. Known groom
candidates as of this
writing: **#80** (docs consolidation — largely overtaken by the docs refresh +
ADRs), **#156** (reconcile schema-api — addressed by that same work), **#33**
(ancient, needs rethink).

## Reviewing PRs: post the review on the PR

A review that lives only in a chat session evaporates when the session ends, and
the next person — or the next agent — has no idea it happened. When you review a
PR, whether you did it yourself or dispatched a review agent, **post the findings
to the PR**, then summarize in chat. One summary comment is usually right; use
inline comments when the findings are line-specific.

Posting is outward-facing, so:

- **Verify each finding before you post it.** A wrong claim on a PR is public,
  gets replied to, and is awkward to retract — far costlier than a wrong
  statement in chat, which is one message away from being fixed. Reproduce each
  finding against the actual code and drop the ones that don't survive. A short
  correct review beats a long plausible one. Say plainly when a change is clean
  rather than padding the list to look thorough.
- **Comment by default; request changes only for a genuine merge blocker; never
  approve.** Nits, style, missing tests, and refactor ideas are a plain comment
  (`gh pr review --comment` or `gh pr comment`). Escalate to `gh pr review
  --request-changes` when merging as-is would do real damage: a **security**
  defect (auth bypass, injection, a leaked secret, an ownership check that lets
  one user reach another's rows), **data loss or corruption** (a destructive
  migration, dropping a column that holds live data), or an **unintended
  breaking change** (an API contract break the ticket didn't ask for, removing a
  field the frontend still reads). Two conditions before you block: the defect is
  *reproduced*, not suspected — if you can't demonstrate it, comment and say what
  you'd need to confirm it — and the damage is unintended, since a breaking
  change the ticket explicitly called for is not a blocker. Name the blocker and
  say what would clear it, so the block is actionable rather than a stop sign.
  **Never `--approve`.** Approval carries merge authority; that stays with a
  human no matter how clean the diff looks.
- **Mark it agent-generated** so a reader can calibrate how much to trust it.
- **Separate confirmed defects from nits**, most severe first, and be explicit
  about which is which.
- **Don't duplicate on re-review.** Reply in the existing thread, or post only
  what changed since the last pass.

## Shepherding a batch of agents

> **Implementing a ticket, or reviewing one PR? Skip this whole section.** It is
> written for the *manager* role — an agent that dispatches other agents across
> several tickets and shepherds their PRs to mergeable. If you were handed a
> ticket, a PR, or a review, none of this applies to you and following it will
> only pull you out of your lane.

Mostly Niteshift-specific: the dispatch mechanics assume `create_task` /
`send_followup` (cloud tasks with their own branches and PRs), and the
re-sync-after-each-merge dance assumes `main` requires branches be up to date.
The review discipline and the triage rules below hold anywhere.

Written from a run of twelve tickets across six PRs, then seven more across six.
Everything here is something that actually bit.

**Group tickets by file overlap, not by theme.** Two tickets that read as
unrelated but edit the same component belong in one task; two that sound like a
pair but touch different directories should be separate PRs. Before dispatching,
map what each branch will touch — and once PRs exist, map it for real:

```bash
for n in "${!BRANCHES[@]}"; do
  git diff --name-only origin/main...origin/${BRANCHES[$n]} | sed "s|^|$n |"
done | sort -k2 | awk '{print $2}' | uniq -d     # files touched by >1 PR
```

That map is also your merge order: **smallest blast radius first, and whichever
PR overlaps the most others goes last**, so each merge shrinks its rebase instead
of growing someone else's. Land infrastructure that protects the rest of the
batch (a CI gate, a shared primitive) before the PRs it protects.

**Write dispatch prompts that make the call.** For anything with options, state
the decision and the reasoning, then ask the agent to sanity-check it against the
code rather than follow it blindly, and to say so if the code disagrees. Hand
over the hazards you already know (the deleted-entity path, the boundary case,
the conflicting PR landing in parallel) — an agent that is told what to worry
about tests it; one that isn't, won't.

**Interim reviews report to you. Only a consolidated comment lands on the PR.**
Spawn reviewers as read-only agents with an explicit instruction not to
`checkout`/`stash`/commit — several agents in one working tree will collide, and
`git show origin/<branch>:<path>` is enough to review from. Have them return a
compact severity-ranked list, not prose. You triage, dispatch the fixes, and post
**one** comment per PR at the end covering what was reviewed, what was found and
fixed, and what got ticketed. That satisfies the posting convention above without
turning the PR into a thread nobody reads.

**Always re-review the fixes.** This is the highest-value thing in this section.
Across twelve PRs, *half* had a defect introduced by the fix to the first review
— an interim-transcript rework that stranded unsaved text, a duplicate-create
guard that discarded its resume state before two unguarded refetches, a
`lastIndexOf` fallback that ate part of the string it was meant to preserve. A
fix is new code written under time pressure against a narrower brief; treat it
that way.

**Triage: does it belong in this PR, or in a ticket?**

- **Fix here** if the PR introduced it, if it's a stated acceptance criterion, or
  if it's cheap and lives in files already open.
- **Ticket** if it needs a product or design call, if it's pre-existing and
  merely adjacent, or if fixing it would balloon the diff.
- **Write tickets as decisions, not bug reports.** State what's true today with a
  concrete example, lay out the options with their consequences, give a
  recommendation, and say what someone must choose. That is what makes them
  groomable instead of another investigation.
- **Put every new ticket on the board** (`Backlog`) — see "Grooming" for the
  mutations. A ticket that isn't on the board is invisible to the next
  prioritization pass. Note the board is well past 100 items, so item-id lookups
  need the paged query, not a single `first: 100`.

**"CI is green" is not "this will merge clean."** The failures that survive a
green run:

- A clean *textual* merge can produce code that doesn't compile — one PR widening
  a shared type while another adds a consumer conflicts in no file at all. Run
  `npx tsc --noEmit` on every merged tree, and the affected suites when two PRs
  touched the same components.
- Poll for the **SHA to change**, not for the status to be green. A status check
  reports on the tip it ran against; a poller that only reads status will happily
  report "ready" on a stale commit, before the fix you asked for even landed.
- Two PRs can each add migration `0006` without conflicting, then fail
  `alembic upgrade head` in production. Check the head is still singular.
- `docs/kantelo-schema-api.md` collects edits from most PRs in a batch. Auto-merge
  drops sections silently and no test notices. Grep the merged file for each PR's
  contribution.

**You do the mechanical merges; hand back the semantic ones.** Merging `main`
into five branches and pushing is yours. A conflict in a file another PR
substantially rewrote goes back to the task that owns it — and tell it to
re-run its own audit over the merged code, because the thing it checked has
changed underneath it.

**Surface human calls, then actually hold them open.** When an agent flags
something as a product or copy decision, put the concrete before/after in front
of the human and *wait*. A reviewer judging the change "justified" is not the
same as the human deciding it, and it's easy to let a flagged item quietly ride
on a reviewer's verdict. Track them until they're answered.

**Verify what agents report.** They are usually right and occasionally confident
about something stale — a branch that moved, a check that passed on an earlier
tip, a command that doesn't exist in this sandbox (`docker compose` is not always
what's running; agents should verify before assuming the documented dev loop).
Spot-check the claims that would be expensive to get wrong.

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

**A container built before #299 fails these commands immediately** with:

```
python -m pytest: error: unrecognized arguments: --timeout=60
  inifile: /root/practice-journal/backend/pytest.ini
```

`pytest.ini` passes `--timeout=60` (a hung test should fail as one named test,
not eat the CI job — #273), which needs `pytest-timeout` from
`requirements.txt`. Any image or venv predating that line lacks it. Rebuild:

```bash
docker compose build backend && docker compose up -d backend
```

The same applies to a local venv — reinstall from `requirements.txt`. This is
the general rule for a dependency change, but this one is worth calling out
because it fails at argument parsing, before any test runs, so the error names
a flag rather than the missing package.

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
#203–#210); current work is post-Phase-0 features. The Profile tab — account
header, instruments, repertoire library, coaching/preference settings — landed
with #148, the Progress tab (history + insights) with #252/#261, and the
quick-start wizard (Today tab, for users with no active plan) with #151.

## Conventions for working here

- Match surrounding style; keep changes scoped to the task.
- Don't commit or push unless asked. Branch off `main` before committing.
- When the work traces to a GitHub issue (e.g. a Niteshift run dispatched from a
  ticket), **include the issue number in the branch name** —
  `issue-<N>-<slug>`, e.g. `issue-150-insights-tab`. It ties the branch, its PR,
  and the ticket together at a glance and makes the board easy to cross-reference.
- Backend and frontend each have their own `.env`; the repo root `.env` also
  feeds `NEXT_PUBLIC_*` build args into the frontend Docker build.
