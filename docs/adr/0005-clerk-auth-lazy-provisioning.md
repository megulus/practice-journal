# ADR-0005 — Authentication via Clerk, with lazy user provisioning

- **Status:** Accepted (revisited 2026-07 — see Consequences)
- **Date:** Reconstructed 2026-07-28 (original decision predates this record)

## Context

Kantelo needs per-user authenticated data with social login and session
management across a Next.js frontend and a FastAPI backend. Building auth
in-house — password hashing, sessions, email verification/resets, social
providers, bot mitigation — is high-effort, high-risk, and undifferentiated for
this product.

## Decision

Use **Clerk** as the identity provider on both ends. The frontend uses Clerk's
SDK for the sign-in UI and mints short-lived JWTs; the backend treats Clerk as
the identity source of truth and verifies those JWTs. The local `users` row is
created **lazily on the first authenticated API call** (from JWT claims), not via
a signup webhook.

## Rationale

- Offloads the hard, easy-to-get-wrong parts of auth to a specialist.
- JWT verification keeps the backend **stateless** — no session store; each
  request carries a verifiable token.
- Lazy provisioning avoids coupling to a Clerk signup webhook and keeps the local
  model minimal: identity lives in Clerk; the local row is a FK anchor + profile
  cache.

## Alternatives considered

- **Roll your own** — rejected: effort/risk, and nothing about Kantelo's auth is
  differentiating.
- **Auth0 / Supabase Auth / NextAuth** — comparable managed options; Clerk chosen
  for first-class Next.js App Router support and batteries-included UI
  components. *(Reconstructed — the head-to-head wasn't recorded.)*

## Consequences

- The backend must verify Clerk JWTs against Clerk's JWKS (signature/expiry/
  issuer). Later hardened: verify RS256 against JWKS, reject `alg:none` and
  HS/RS key-confusion, and handle Clerk's unpadded-base64 publishable keys.
- Lazy provisioning introduced a **first-request race**: a new user's first page
  load fires several concurrent requests that all try to `INSERT` the same user,
  tripping the unique `clerk_user_id` constraint and returning 500s. Resolved
  2026-07 with an atomic `INSERT ... ON CONFLICT DO NOTHING` upsert (ADR-0003).
- Vendor dependency: identity is Clerk's; an outage or provider migration would
  be a significant event.
