# ADR-0006 — Next.js App Router with `(auth)`/`(app)` route groups

- **Status:** Accepted
- **Date:** Reconstructed 2026-07-28 (original decision predates this record)

## Context

The frontend has two distinct shells: unauthenticated pages (sign-in/sign-up)
that render bare, and the authenticated app (Today, Plans, Progress, Profile,
Session) that shares a nav shell, padding, and layout.

## Decision

Use **Next.js 14 App Router** with route groups: `(auth)` for the passthrough
auth pages and `(app)` for the authenticated shell. `(app)/layout.tsx` wraps
pages in `AppShell` (bottom/side nav, the centered `max-w-[520px]` column); the
root layout provides `ClerkProvider` + theme.

## Rationale

- Route groups separate the two shells without affecting URL paths (the parens
  are syntactic), so `/today` stays `/today`.
- Layout nesting means the shell (nav, container width, padding) is defined once
  in the group layout; pages don't re-implement it.
- App Router's server/client component split and file-based routing fit the
  tab-based IA cleanly.

## Alternatives considered

- **Pages Router** — mature, but App Router is the current direction and gives
  nested layouts natively. *(Reconstructed.)*
- **A single layout with conditional chrome** — messier than two group layouts;
  conditionals everywhere vs. structure. *(Reconstructed.)*

## Consequences

- `AppShell` owns the `<main>` + container width + padding; pages must **not**
  nest their own `<main>` or re-add page padding (a real gotcha — the
  "double-main" bug).
- Middleware protects everything except `/sign-in`, `/sign-up`, and webhooks.
- The Docker Node version is pinned because a floating bump reintroduced a
  dev-mode Clerk middleware `EvalError` under the App Router's Edge runtime
  (documented in `frontend/CLAUDE.md`).
