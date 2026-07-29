# Architecture Decision Records

This directory records the significant architecture decisions behind Kantelo —
what was chosen, and *why*.

## ⚠️ These are reconstructed

The original ADRs were lost in a laptop switch (they were never committed). This
set was **reconstructed on 2026-07-28** from the code, the design docs (notably
`../kantelo-schema-api.md` §1, which records the data-model rationale), and git
history. Consequences that the project actually lived through are drawn from git;
some *rationale* and *alternatives-considered* are inferred and are marked as
**(reconstructed)** where the original deliberation wasn't recorded. Treat those
lines as a plausible scaffold to confirm or correct, not as gospel. Original
decision dates are unknown — the "reconstructed" date is when this record was
written, not when the decision was made.

## How to use these

An ADR is a **dated record of a decision made at a point in time** — not a
description of current state. That's what keeps it from going stale: "we chose X
because Y" stays true forever, even after the decision is later reversed.

So **don't edit an ADR to reflect a change.** When a decision changes, add a
*new* ADR that supersedes the old one, and flip the old one's status to
`Superseded by ADR-NNNN`. The superseded ADR stays in place as history. This
append-only discipline, plus the `Status` field, is what keeps the set honest.

## Status legend

- **Accepted** — in force.
- **Superseded by ADR-NNNN** — replaced by a later decision; kept for history.
- **Deprecated** — no longer applies, not directly replaced.
- **Proposed** — under consideration, not yet decided.

## Index

| # | Decision | Status |
|---|----------|--------|
| [0001](0001-fastapi-async-backend.md) | FastAPI with async throughout | Accepted |
| [0002](0002-sqlmodel-unified-models.md) | SQLModel for unified ORM + schema models | Accepted |
| [0003](0003-postgresql-load-bearing.md) | PostgreSQL as a load-bearing (not swappable) choice | Accepted |
| [0004](0004-alembic-real-migrations-in-tests.md) | Alembic migrations, exercised by the real test suite | Accepted |
| [0005](0005-clerk-auth-lazy-provisioning.md) | Authentication via Clerk, with lazy user provisioning | Accepted |
| [0006](0006-nextjs-app-router-route-groups.md) | Next.js App Router with `(auth)`/`(app)` route groups | Accepted |
| [0007](0007-design-tokens-source-of-truth.md) | Design tokens as the styling source of truth | Accepted |
| [0008](0008-docker-compose-dev-railway-prod.md) | Docker Compose for dev, Railway for prod | Accepted |
| [0009](0009-handrolled-primitives-radix-for-menus.md) | Hand-rolled UI primitives; a library only for hard a11y | Accepted |
| [0010](0010-no-external-state-library.md) | No external state-management library | Accepted |
| [0011](0011-soft-delete-everywhere.md) | Soft delete everywhere | Accepted |
| [0012](0012-ownership-checks-return-404.md) | Ownership checks return 404, not 403 | Accepted |
| [0013](0013-naive-utc-timestamps.md) | Naive-UTC timestamps via a single helper | Accepted |
| [0014](0014-coaching-engine-rules-orchestrator.md) | Coaching engine as isolated rules + orchestrator | Accepted |
| [0015](0015-schema-opinionated-for-product-thesis.md) | An opinionated schema in service of the product thesis | Accepted |
