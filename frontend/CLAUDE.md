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

## Architecture

This is a **Next.js 14 App Router** application (TypeScript, Tailwind CSS) for tracking music practice sessions across multiple instruments. It connects to a backend API (default: `http://localhost:8000`).

The frontend is mid-rebuild against the new Kantelo schema and design system. See `docs/kantelo-frontend-plan.md` for the phased plan and `docs/phase-0-audit.md` for the design-system gap audit.

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

Phase 0 will add `src/components/ui/` for design-system primitives (Button, Card, Pill, etc.).

### Styling

Tailwind CSS with a stock indigo theme in `tailwind.config.ts`. **This is not the long-term design system** — Phase 0 of the rebuild replaces it with the warm-stone + teal token system specified in `docs/kantelo-design-tokens.md`. Until that lands, screens use stock Tailwind utility classes (`bg-gray-50`, `text-primary-600`, etc.).

## Environment Variables

Required in `.env.local`:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` — Clerk auth keys
- `NEXT_PUBLIC_API_URL` — Backend API base URL (default: `http://localhost:8000`)
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL`, `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` — Clerk routing config

Local Docker also requires the `NEXT_PUBLIC_*` vars in the repo-root `.env` so they reach the frontend Dockerfile build args (see `docker-compose.yml`).
