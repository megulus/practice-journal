# ADR-0014 — Coaching engine as isolated rules + orchestrator

- **Status:** Accepted
- **Date:** Reconstructed 2026-07-28 (original decision predates this record)

## Context

Kantelo's differentiator is coaching: surfacing the right suggestion at the right
moment (pre-session, in-session, post-session) from practice history. This logic
is the product's core value and will grow in complexity, so it must stay testable
and separable from HTTP concerns.

## Decision

Isolate the coaching logic in its own package, `app/suggestions/`, structured as
**individual rules plus an orchestrator** that selects/prioritizes among them
(a tiered suggestions model). Routers call the engine; they don't contain
coaching logic.

## Rationale

- Rules are individually testable in isolation, without spinning up HTTP.
- New coaching behavior is a new rule, not a change threaded through endpoint
  code — additive and low-risk.
- The orchestrator centralizes selection/prioritization (which suggestion wins,
  dismissal handling) so precedence lives in one place.
- Keeps the engine independent of transport, matching the general layering
  (routers thin, logic in `services/` and `suggestions/`).

## Alternatives considered

- **Suggestion logic inline in routers/services** — couples coaching to HTTP and
  scatters precedence; hard to test and evolve. *(Reconstructed.)*
- **A rules-engine library / external ML service** — over-engineered for a
  deterministic tiered-rules v1. *(Reconstructed.)*

## Consequences

- Suggestions have supporting schema (dismissals, interactions) so the engine can
  respect what a user has dismissed and learn from interactions.
- As coaching sophistication grows, this package is the seam to extend; a
  significant redesign (e.g. moving to learned models) would warrant a superseding
  ADR.
