# ADR-0003 — PostgreSQL as a load-bearing (not swappable) choice

- **Status:** Accepted
- **Date:** Reconstructed 2026-07-28 (original decision predates this record)

## Context

Kantelo needs a relational store for a fairly normalized schema (users,
instruments, templates, sessions, repertoire) with real constraints and
concurrency.

## Decision

Use **PostgreSQL**, and rely on Postgres-specific features deliberately rather
than treating the database as an interchangeable backend.

## Rationale

Several core behaviors depend on Postgres features and would not port cleanly:

- **Partial unique indexes** — "one active template per instrument" is enforced
  by `CREATE UNIQUE INDEX ... WHERE is_active = true AND deleted_at IS NULL`
  (see ADR-0015 / schema-api §1).
- **`INSERT ... ON CONFLICT`** — the lazy-user-provisioning race (ADR-0005) is
  resolved with an atomic upsert.
- **`TIMESTAMPTZ`** semantics — see ADR-0013.
- Mature async driver (`asyncpg`) for the async stack (ADR-0001).

## Alternatives considered

- **SQLite** — great for dev/simplicity, but lacks the concurrency story and
  some of the index/constraint features leaned on here. *(Reconstructed.)*
- **MySQL** — viable, but weaker partial-index / upsert ergonomics for these
  patterns. *(Reconstructed.)*

## Consequences

- The app is intentionally *not* database-agnostic; migrating engines would mean
  reworking the constraints and upserts above. Accepted trade-off — those
  features do real work.
- Dev and prod both run Postgres (Docker Compose locally, Railway in prod) so
  behavior matches (ADR-0008), and tests run against real Postgres (ADR-0004).
