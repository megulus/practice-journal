# ADR-0013 — Naive-UTC timestamps via a single helper

- **Status:** Accepted
- **Date:** Reconstructed 2026-07-28 (original decision predates this record)

## Context

Timestamps are written from async code using the `asyncpg` driver against
Postgres `TIMESTAMPTZ` columns. `asyncpg` requires **naive** datetimes for these
columns, and mixing naive/aware datetimes across the codebase invites subtle
timezone bugs.

## Decision

Standardize on **naive UTC** timestamps everywhere, produced by a single helper:
`utcnow()` in `app/enums.py` (a naive `datetime` with tzinfo stripped).
`datetime.utcnow()` / `datetime.now()` are never used directly.

## Rationale

- `asyncpg` needs naive datetimes for these columns; a single helper guarantees
  that invariant instead of relying on every call site to remember it.
- Postgres `TIMESTAMPTZ` treats the stored value as UTC, so "naive value that is
  always UTC" is coherent end to end.
- One function to audit and change if the policy ever needs to.

## Alternatives considered

- **Timezone-aware datetimes throughout** — cleaner in pure-Python terms, but
  fights the `asyncpg`/column requirement here. *(Reconstructed.)*
- **Ad-hoc `datetime.utcnow()` at call sites** — works until one call site drifts
  (aware vs naive, local vs UTC); rejected for a single helper.

## Consequences

- Serialized timestamps carry no offset, so the **frontend appends `Z`** before
  parsing to interpret them as UTC (otherwise the browser reads them as local
  time and they're off by the offset). This is handled in the frontend date
  utilities.
- New model timestamp fields should default via `utcnow` (Python-side), and any
  Core-level insert that bypasses the ORM default must set the timestamp
  explicitly (as the user-creation upsert does — ADR-0005).
