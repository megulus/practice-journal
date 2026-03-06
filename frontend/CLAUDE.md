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

### Authentication

Uses **Clerk** (`@clerk/nextjs`) for all authentication:
- `src/middleware.ts` protects all routes except `/sign-in`, `/sign-up`, and `/api/webhooks`
- Root layout wraps the app in `<ClerkProvider>`
- Client components use `useUser()` for auth state and `useAuth()` + `getToken()` for JWT tokens

### API Layer

- `src/lib/api.ts` — Factory function `createAuthenticatedAPI()` returns an object with methods for all backend endpoints. Each method injects a Bearer JWT token from Clerk.
- `src/lib/useApi.ts` — Custom hook that memoizes the authenticated API client for use in components.
- `next.config.js` rewrites `/api/*` requests to the backend URL (`NEXT_PUBLIC_API_URL`).

### Routing

Dynamic routes follow the pattern `/{instrument-slug}/{page}`:
- `/` — Home page: instrument dashboard, onboarding for new users
- `/[instrument]/plan` — View practice plan with day selector
- `/[instrument]/log` — Log a practice session
- `/[instrument]/history` — Analytics summary and session history

### State Management

No external state library. Components use React hooks (`useState`, `useEffect`, `useMemo`) with local state and prop-based communication.

### Types

All shared TypeScript interfaces are in `src/lib/types.ts` (Instrument, Exercise, PracticeDay, PracticeTemplate, PracticeLog, AnalyticsSummary, etc.).

### Styling

Tailwind CSS with a custom theme defined in `tailwind.config.ts`. Primary palette is indigo, secondary is purple. The app uses gradient backgrounds, card-based layouts, and mobile-first responsive design.

## Environment Variables

Required in `.env.local`:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` — Clerk auth keys
- `NEXT_PUBLIC_API_URL` — Backend API base URL (default: `http://localhost:8000`)
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL`, `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` — Clerk routing config
