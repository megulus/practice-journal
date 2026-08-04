# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
npm run dev        # Start dev server at http://localhost:3000
npm run build      # Production build
npm run start      # Run production build
npm run lint       # ESLint with next/core-web-vitals rules
npm test           # Run tests (Vitest)
npm run test:watch # Run tests in watch mode
```

**Don't run `npm run build` against a tree with a dev server running on it.**
Both write `frontend/.next`, so the build replaces the dev server's chunks
under it and every route starts 500-ing with `MODULE_NOT_FOUND` until the dev
server is restarted with a clean `.next`. `docker compose up` is safe — the
compose file shadows `.next` with an anonymous volume (`- /app/.next`) — but a
natively-run `next dev` (which is how cloud sandboxes start this app) shares
the directory. CI runs the production build on every PR, so there's rarely a
reason to run it by hand anyway; if you must, build a copy of the tree.

**Docker Node version is pinned.** `frontend/Dockerfile` uses `node:20.20.2-alpine`
(not the floating `node:20-alpine`). A silent bump to a newer Node can reintroduce
the dev-mode Clerk middleware `EvalError` from #192 — Next 14's Edge Runtime runs
middleware in a `vm` context with `codeGeneration.strings=false`, and stricter vm
enforcement in some Node builds rejects the `eval()`-based HMR source maps, 404-ing
every protected route under `docker compose up`. To move the pin, bump it deliberately
and re-test `docker compose up` while signed in (a protected route must load, HMR intact).

## Architecture

This is a **Next.js 14 App Router** application (TypeScript, Tailwind CSS) for tracking music practice sessions across multiple instruments. It connects to a backend API (default: `http://localhost:8000`).

The frontend's Phase-0 rebuild against the new Kantelo schema and design system is complete — all core screens are retoned to the token/primitive system (PRs #203–#210). See `docs/kantelo-frontend-phase-0-plan.md` for the (historical) Phase 0 plan. Current work is post-Phase-0 features; for what's built vs. planned, see the GitHub Project board rather than the design docs.

### Authentication

Uses **Clerk** (`@clerk/nextjs`) for all authentication:
- `src/middleware.ts` protects all routes except `/sign-in`, `/sign-up`, and `/api/webhooks`
- Root layout (`src/app/layout.tsx`) wraps the app in `<ClerkProvider>` and renders the html/body shell only
- `src/app/(app)/layout.tsx` wraps authenticated pages in `<AppShell>` (bottom nav, padding)
- `src/app/(auth)/layout.tsx` is a passthrough — auth pages don't render the shell
- Client components use `useUser()` for auth state and `useAuth()` + `getToken()` for JWT tokens

### API Layer

- `src/lib/api.ts` — Factory function `createAuthenticatedAPI()` returns an object with methods for all backend endpoints. Each method injects a Bearer JWT token from Clerk.
- `src/lib/useApi.ts` — Custom hook that memoizes the authenticated API client for use in components.
- `next.config.js` rewrites `/api/*` requests to the backend URL (`NEXT_PUBLIC_API_URL`).

### Routing

Flat tab-based navigation. Files live under `src/app/` organized into two route groups:

```
src/app/
├── layout.tsx              # Root: ClerkProvider + html/body
├── page.tsx                # "/" redirects to /today (signed in) or /sign-in
├── (app)/
│   ├── layout.tsx          # Wraps in AppShell (bottom nav)
│   ├── today/              # /today
│   ├── plans/              # /plans, /plans/[id]
│   ├── progress/           # /progress
│   ├── profile/            # /profile
│   └── session/            # /session/start, /session/[id], /session/[id]/summary
└── (auth)/
    ├── layout.tsx          # Passthrough (no shell)
    ├── sign-in/            # /sign-in
    └── sign-up/            # /sign-up
```

Route group parens are syntactic — they don't affect URL paths. `/today` resolves to `app/(app)/today/page.tsx`.

### State Management

No external state library. Components use React hooks (`useState`, `useEffect`, `useMemo`, `useRef`, `useCallback`) with local state and prop-based communication. The active session screen is the most stateful — see `src/app/(app)/session/[id]/page.tsx` for patterns like the `apiRef`, `pendingFlushes`, and `repertoireBlockIds` refs.

### Types

All shared TypeScript interfaces live in `src/lib/types.ts`. Major shapes:

- **Identity**: `User`, `UserSettings`, `Instrument`
- **Templates**: `Template`, `TemplateSession`, `Section`, `Block` (standard + repertoire variants)
- **Repertoire**: `Piece`, `Spot`, `DefaultSpot`, `SpotHistory`
- **Practice sessions**: `PracticeLog`, `SectionLog`, `BlockLog`, `FinishResponse`
- **Today / Progress**: `TodayResponse`, `HistoryResponse`, `HeatmapResponse`, etc.
- **Suggestions**: `SuggestionItem`, `PreSessionResponse`, `InSessionResponse`
- **Library**: `CuratedBlock`, `RecentBlock`, `LibraryRepertoireResponse`

### Components

- `src/components/layout/` — `AppShell`, `BottomNav` (and future side nav)
- `src/components/` — feature components (`AddBlockSheet`, `BlockRow`, `SectionCard`, `SessionTabs`, `RepertoireBlock`, `RatingChevrons`, `TimeStepper`, `ConfirmDialog`, `ComingSoonPlaceholder`)
- `src/components/ui/` — design-system primitives (Button, Card, Pill, etc.) — added incrementally during Phase 0 PR 3+

### Styling

Design tokens live in `src/lib/tokens.css` as CSS custom properties (light by default, dark mode under `[data-theme="dark"]`). The token names and values are the source of truth — see `docs/kantelo-design-tokens.md`.

`tailwind.config.ts` exposes every token as a Tailwind utility by referencing the matching CSS variable. Utility names match the token names verbatim, which means some doubled prefixes (`bg-page-bg`, `text-text-primary`, `border-border-default`) — chosen so the design doc remains the unambiguous source of truth. Common utility shapes:

- Surfaces: `bg-page-bg`, `bg-card-bg`, `bg-card-bg-inset`, `bg-input-bg`, `bg-input-bg-recessed`
- Text: `text-text-primary`, `text-text-secondary`, `text-text-tertiary`, `text-text-link`, `text-text-on-primary-action`
- Borders: `border-border-default`, `border-border-subtle`, `border-border-input`, `border-border-input-focus`
- Primary (teal action): `bg-primary`, `bg-primary-hover`, `bg-primary-subtle-bg`, `text-primary-subtle-text`, `border-primary-subtle-border`
- Spacing: `p-md`, `p-lg`, `p-4xl` (4/6/8/12/14/16/18/20px → `xs`, `sm`, `md`, `lg`, `xl`, `2xl`, `3xl`, `4xl`)
- Radii: `rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-pill`, `rounded-round`
- Fonts: `font-sans` (IBM Plex Sans), `font-wordmark` (Finlandica — wordmark only)

Section type colors aren't exposed as Tailwind utilities — they're applied via `getSectionColor()` and inline `style={{}}` because they encode an assignment rule (pinned warm-up/cool-down + 8-color pool by display order). See `src/lib/section-colors.ts`.

All core screens (Today, Active session, Session summary, Plans list, Plans editor, Profile) have been retoned to the token/primitive system (PRs #203–#210); the previous indigo-theme Tailwind classes are gone. If you find a screen still using stock/legacy classes, treat it as a bug to retone, not intended jank.

### Previewing primitives

`/preview` is a dev-only route that renders every primitive in light and dark scope side by side. Available locally at http://localhost:3000/preview without any flag. The gate lives in `src/app/preview/page.tsx` (server component checks `NODE_ENV` and redirects to `/today` in prod unless `NEXT_PUBLIC_PREVIEW_ENABLED=1` was set at build time); the side-by-side render is in `src/app/preview/PreviewContent.tsx`.

## Environment Variables

Required in `.env.local`:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` — Clerk auth keys
- `NEXT_PUBLIC_API_URL` — Backend API base URL (default: `http://localhost:8000`)
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL`, `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` — Clerk routing config (the `*_FALLBACK_REDIRECT_URL` pair replaced the deprecated `*_AFTER_SIGN_IN/UP_URL` vars in Clerk v6)

Optional (build-time only — must be set as a build arg, not a runtime env var, since `NEXT_PUBLIC_*` vars are inlined at build):
- `NEXT_PUBLIC_PREVIEW_ENABLED` — set to `1` to expose `/preview` in a production build. Off by default; the route redirects to `/today` without it.

Local Docker also requires the `NEXT_PUBLIC_*` vars in the repo-root `.env` so they reach the frontend Dockerfile build args (see `docker-compose.yml`).
