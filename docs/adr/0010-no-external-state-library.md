# ADR-0010 — No external state-management library

- **Status:** Accepted
- **Date:** Reconstructed 2026-07-28 (original decision predates this record)

## Context

The frontend has per-screen state and needs to talk to the backend, but it is not
a heavily cross-cutting-shared-state app — most state is local to a screen, and
server data is fetched per view.

## Decision

Use **React's built-in hooks** (`useState`, `useEffect`, `useMemo`, `useRef`,
`useCallback`) with local state and prop passing. **No** Redux/Zustand/Jotai/etc.
Server calls go through a memoized authenticated API client (`useApi()` over
`createAuthenticatedAPI()` in `src/lib/api.ts`).

## Rationale

- The app's state is mostly view-local; a global store would add ceremony without
  a real cross-screen-sharing problem to solve.
- Fewer concepts and dependencies; new screens follow the same simple pattern.
- The authenticated API client centralizes the one genuinely shared concern
  (attaching the Clerk token), which is where the complexity actually is.

## Alternatives considered

- **Redux / Zustand / Jotai** — powerful, but unjustified given the state shape;
  premature global state tends to invite putting things there that shouldn't be.
  *(Reconstructed.)*
- **A data-fetching/caching library (React Query/SWR)** — reasonable and could be
  adopted later; for v1 the per-view fetch pattern was kept simple. *(Reconstructed.)*

## Consequences

- The one genuinely stateful screen — the active session — carries its complexity
  locally via refs (`apiRef`, pending-flush queues, repertoire-block id tracking)
  rather than a store. That's the accepted concentration point.
- If cross-screen caching/invalidation needs grow, revisit with a superseding ADR
  (e.g. adopt React Query) rather than editing this one.
