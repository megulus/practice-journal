# ADR-0012 — Ownership checks return 404, not 403

- **Status:** Accepted
- **Date:** Reconstructed 2026-07-28 (original decision predates this record)

## Context

Nearly every resource is user-scoped. Endpoints must reject access to resources
that don't exist, are soft-deleted, or belong to another user — and they must do
so consistently, without leaking information.

## Decision

Fetch user-scoped resources through **shared ownership helpers** in
`app/api/ownership.py` (`get_owned_instrument`, `get_owned_template`,
`get_owned_session`, …). When a resource is missing, soft-deleted, or owned by
someone else, they raise **404 — not 403**.

## Rationale

- **Don't leak existence.** A 403 on someone else's resource confirms it exists;
  a uniform 404 does not. Same response whether the id is bogus or simply not
  yours.
- Centralizing the check means every endpoint enforces ownership + the
  soft-delete filter (ADR-0011) identically, instead of re-implementing it (and
  occasionally forgetting a case).

## Alternatives considered

- **403 for "exists but not yours"** — more semantically precise, but leaks
  existence; rejected. *(Reconstructed.)*
- **Per-endpoint ad-hoc checks** — drift and omission risk; rejected in favor of
  shared helpers.

## Consequences

- Callers can assume a returned resource is alive and owned by the current user.
- The 404-not-403 behavior is deliberate and should be preserved; it's covered by
  the integration tests (cross-user access returns 404).
