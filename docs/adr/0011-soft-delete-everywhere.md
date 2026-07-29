# ADR-0011 — Soft delete everywhere

- **Status:** Accepted
- **Date:** Reconstructed 2026-07-28 (original decision predates this record)

## Context

User data (instruments, templates, pieces, sessions) can be removed, but hard
deletes destroy history that has analytical and coaching value, and make
accidental deletion unrecoverable.

## Decision

**Soft delete** across the board: records carry a nullable `deleted_at`
timestamp. "Alive" queries filter `deleted_at IS NULL` (written as
`deleted_at == None` with `# noqa: E711` for the SQLAlchemy `== None` idiom).
Records are never hard-deleted.

## Rationale

- Preserves history (streaks, past sessions, repertoire progress) even after a
  user "deletes" something.
- Deletion becomes reversible; archival and delete can share machinery.
- Consistent rule across all tables is easy to reason about.

## Alternatives considered

- **Hard delete** — simplest reads (no filter), but destroys history and is
  unrecoverable. *(Reconstructed.)*
- **Separate archive tables** — more moving parts than a `deleted_at` column.
  *(Reconstructed.)*

## Consequences

- **Every "alive" read must include the `deleted_at IS NULL` filter** — forgetting
  it is the characteristic soft-delete bug. Centralized in the ownership helpers
  (ADR-0012).
- Uniqueness constraints must account for it — e.g. the one-active-template
  partial index includes `AND deleted_at IS NULL` (ADR-0015).
- Note the distinction from domain-level lifecycle flags that are *not* deletion:
  Spots use `retired_at` (a repertoire state), and SectionLog uses `skipped`
  (a session state) — both are separate from `deleted_at`.
