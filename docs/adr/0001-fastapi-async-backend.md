# ADR-0001 — FastAPI with async throughout

- **Status:** Accepted
- **Date:** Reconstructed 2026-07-28 (original decision predates this record)

## Context

Kantelo's backend is I/O-bound: nearly every request does database work and,
for auth, fetches/validates against Clerk's JWKS. It needs typed request/response
handling, automatic OpenAPI docs, and dependency injection for auth and DB
sessions.

## Decision

Build the backend on **FastAPI**, and make the whole stack **async** — routers,
services, and DB access all use `async`/`await` (`AsyncSession`,
`await session.exec(...)`). No synchronous DB calls are introduced.

## Rationale

- Async gives concurrency for I/O-bound work without threads — many requests can
  be in flight (waiting on Postgres or the network) on a single worker.
- FastAPI's dependency-injection model fits the auth + DB-session pattern cleanly
  (`Depends(get_current_user)`, `Depends(get_session)`).
- Automatic OpenAPI/Swagger docs come for free.
- Committing to async *everywhere* avoids the classic trap of a lone sync call
  blocking the event loop.

## Alternatives considered

- **Flask / Django REST** — mature, but sync-first; async is bolted on.
  *(Reconstructed.)*
- **Sync FastAPI** — simpler mental model, but forfeits the concurrency benefit
  for exactly the I/O-bound workload this app has.

## Consequences

- Every DB helper and service must be async and awaited; a stray sync DB call is
  a bug (enforced by convention, noted in CLAUDE.md).
- Requires an async driver (`asyncpg`) — see ADR-0003, ADR-0013 (asyncpg's naive
  datetime requirement).
