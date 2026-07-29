# ADR-0015 — An opinionated schema in service of the product thesis

- **Status:** Accepted
- **Date:** Reconstructed 2026-07-28 (original decision predates this record)

## Context

Kantelo's thesis is *practice smarter, not just more* — reduce decision fatigue
and make good practice the path of least resistance. The data model is not a
neutral CRUD schema; several decisions deliberately encode that thesis (and its
UX) as structure and constraints.

> The per-decision rationale for the data model is recorded in
> [`../kantelo-schema-api.md`](../kantelo-schema-api.md) §1 ("Key design
> decisions"). This ADR captures the *through-line* rather than duplicating that
> catalogue — see §1 for the authoritative details.

## Decision

Let the schema be opinionated where it serves the product thesis, rather than
maximally generic. The load-bearing examples (details in schema-api §1):

- **One active template per instrument**, enforced by a partial unique index — so
  the Today tab always has exactly one plan to show. The constraint *is* the
  anti-decision-fatigue principle.
- **Instruments are user-owned, not shared** — no system-instruments + join-table
  indirection; avoids permission complexity for no user benefit.
- **Blocks: two flavors, one table** (standard vs. repertoire, distinguished by
  `piece_id`; a check constraint forbids "both") — avoids a polymorphic hierarchy.
- **Repertoire is per-instrument and persists independently of templates** — a
  piece's spot history survives template archival/rebuild.
- **SectionLog as an intermediate log table** — mirrors the section-level time
  stepper the UI actually has, even though the spec modeled PracticeLog → BlockLog
  directly.
- **Directional integer ratings** (-1/0/+1) — trivial aggregation (`AVG > 0` =
  trending forward), no enum overhead.
- **`retired_at` on spots (not a boolean)** and **nullable `spot_id` on BlockLog**
  — preserve history/analytics and let quick "whole-piece" logging coexist with
  granular spot tracking.

## Rationale

Encoding product intent as constraints makes the desired behavior the default and
the undesired behavior *impossible* (e.g. two active plans can't exist to create
a choice). It also keeps the schema honest about how musicians actually
experience practice (repertoire is per-instrument; pressed-for-time logging is
first-class).

## Alternatives considered

- **A generic, maximally-flexible schema** (shared entities, polymorphic blocks,
  multiple active plans) — more "reusable," but pushes decisions onto the user and
  the UI, reintroducing the fatigue the product exists to remove. *(Reconstructed.)*

## Consequences

- The schema is intentionally coupled to the product thesis; a product-direction
  change (e.g. supporting multiple simultaneous active plans) would ripple into
  constraints and require a superseding decision here **and** an update to
  schema-api §1.
- These constraints lean on Postgres features (partial indexes, check
  constraints) — see ADR-0003.
