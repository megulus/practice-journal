# ADR-0016 — Mobile platform: React Native (Capacitor and PWA rejected)

- **Status:** Accepted
- **Date:** 2026-09-30

## Context

A first-class mobile experience is a v1 goal (see [#54](https://github.com/megulus/practice-journal/issues/54), and the original mobile ticket [#44](https://github.com/megulus/practice-journal/issues/44)). Three delivery models were on the table: a **PWA**, **Capacitor** (wrap the existing web app in a WKWebView), and **React Native**.

The Capacitor option was investigated properly in the [#305](https://github.com/megulus/practice-journal/issues/305) spike, whose durable record is [`../kantelo-capacitor-spike.md`](../kantelo-capacitor-spike.md) (device run completed 2026-09-28/29). That spike is what makes this decision evidence-based rather than a guess.

The decisive product input: **the differentiating feature is a live-listening coach** — the app listens while you play, gives real-time feedback, and generates drills on the fly. That is a real-time audio-DSP + on-device-ML application. It is not v1, but it defines what "first-class mobile" has to mean here.

## Decision

**Build mobile on React Native.** Capacitor is rejected; PWA is rejected. Full-native (Swift/Kotlin) is deferred as a later, deliberately-reversible option, not chosen now.

No interim PWA bridge will be shipped — the audience (musicians expecting an app) is not one that "Add to Home Screen" serves.

## Rationale

- **A webview can't host the differentiator.** Real-time DSP and on-device ML — the live-listening coach — are structurally poor fits for a WKWebView (Web Audio latency, background-audio limits, no native ML path). Both Capacitor and a PWA are webviews. The moment the flagship *is* the mobile experience, a wrapper is the wrong tool for the thing that matters most.
- **Capacitor's expected edge evaporated, and it adds a liability.** The #305 spike hypothesised native dictation would beat the web; on-device it came back a **tie** (both engines mangled "intonation" identically). Separately, `output: 'export'` deletes Next middleware, trading Kantelo's **server-side** auth guarantee for a **client-side race** — a blank-window on every cold launch (it read as "Clerk is broken" three times during the run). Not a data leak (the API is bearer-gated), but a permanent per-launch UX cost and a new bug category the web path doesn't have.
- **PWA is cheapest but wrong for the audience.** It keeps the server-side auth guarantee and costs almost nothing, but gives no App Store presence — the wrong trade for this product.
- **React Native over full-native.** The differentiating DSP/ML engine is a **native module either way**, so RN concedes essentially nothing on the part that matters, while giving Android largely for free and keeping TS/React velocity for the ~80% of the app that is not audio. Keeping the DSP core **portable (C++)** makes a later move to full-native a re-wrap of the shell, not a rewrite of the engine — so "RN now" does not foreclose "native later."
- **The auth story is also cleaner on RN.** `@clerk/clerk-expo` stores the session in the native secure store (Keychain/Keystore), which erases the entire webview-cookie saga the spike hit (`CapacitorCookies`, `standardBrowser`), and the web app keeps its server-side `clerkMiddleware` untouched.

## Alternatives considered

- **PWA** — cheapest, non-throwaway, server-side auth intact; rejected on audience/distribution (no App Store presence).
- **Capacitor** — cheapest *port* (reuses the web UI, ~2–3 weeks), but the wrong tool for the real-time-audio flagship, plus the voice tie and the auth-gating liability. A Capacitor port would also be throwaway work once RN lands. Rejected.
- **Full native (Swift/Kotlin)** — best latency headroom and frontier-API access, but two languages and two platforms to maintain; deferred, and kept reachable by keeping the DSP core portable.

## Consequences

- **The port is a view-layer rebuild** (~6–9 engineering weeks to a polished TestFlight of current features — roughly 2–3× a Capacitor port), because RN renders native views, not the DOM. See the audit below.
- **Apple obligations become real work:** Sign in with Apple (App Store guideline 4.8), in-app account deletion (5.1.1) — which also needs a backend `DELETE /api/user/me`, since deleting the Clerk user does not remove Kantelo data — a privacy manifest, signing, and the $99/yr membership.
- **Repo restructure:** a shared non-UI **core package** consumed by both web and mobile (below).
- **Two in-flight tickets become foundational:** [#331](https://github.com/megulus/practice-journal/issues/331) (Clerk Core 3 — the clerk-expo path wants it) and [#324](https://github.com/megulus/practice-journal/issues/324) option 2 (the `VoiceInput` provider abstraction *is* the shared voice interface).
- **Ticket cleanup:** [#44](https://github.com/megulus/practice-journal/issues/44) closed as superseded (it floated PWA-as-intermediate, now explicitly rejected); [#54](https://github.com/megulus/practice-journal/issues/54) rescoped from Capacitor to React Native; the spike harness PR [#323](https://github.com/megulus/practice-journal/pull/323) closed unmerged (per its own note).

---

## Audit

Grounded in the actual `frontend/` tree at the time of decision: **197 `.ts`/`.tsx` files, 149 `.tsx`, 77 `'use client'`**, 6-package runtime dependency list, Tailwind styling, no external state library.

### Part 1 — Porting the current app to React Native

The port is a **view-layer rebuild on top of a highly reusable non-view core**, and the dependency surface is unusually clean.

**Dependency mapping (the whole runtime dep list):**

| Today | React Native | Friction |
|---|---|---|
| `@clerk/nextjs` (9 files) + `/server` (1) | `@clerk/clerk-expo` | low; native secure-store session |
| `lucide-react` | `lucide-react-native` | trivial |
| `@radix-ui/react-dropdown-menu` (only `Menu.tsx`) | native menu / ActionSheet | one component |
| `next` (routing/link/font) | Expo Router (or React Navigation) + `expo-font` | moderate |
| `react-dom` | `react-native` | n/a |
| `tailwindcss` | **NativeWind** | biggest lever — keeps the Tailwind vocabulary and tokens |

**Reuse as-is (the non-view core):** `lib/` — `types.ts`, `api.ts` (its `createAuthenticatedAPI` already takes an injected token-getter), `dates`, `duration`, `idempotency`, `quickstart`, `section-colors`, `confirm-copy`, `cx`, and `metronome.ts` (tempo *logic*; contains no Web Audio, so it ports as logic — audible playback is new native work). `useApi.ts` is **not** reusable as-is — it imports `@clerk/nextjs` and `next/navigation`, so it stays a thin per-platform wrapper over the core client. Data fetching is hand-rolled `fetch` + bearer (no react-query/redux/zustand), and `fetch` works unchanged in RN. The backend coaching engine is untouched (server-side).

**Mechanical swaps (low risk):** `next/navigation` (13) + `next/link` (10) → the router; `localStorage` (6) → AsyncStorage / `expo-secure-store`; `middleware.ts` → deleted, replaced by clerk-expo client gating; `matchMedia`/`ResizeObserver` (3) → `useWindowDimensions`.

**The rewrite — the view layer (the real cost):** all **149 `.tsx`** files. Order: **~19 UI primitives first** (`Button`, `Card`, `Dialog`, `Menu`, `TextInput`, the rating/rotation/pip family), then the ~90 feature components (session 17, progress 21, repertoire 16, profile 12, quickstart 11, layout 13), then the 10 route screens.
- `div/span/button/input` → `View/Text/Pressable/TextInput`; all text must live inside `<Text>`.
- **639 `className` usages / Tailwind → NativeWind** keeps the Tailwind vocabulary and tokens on RN. Caveats: non-translating utilities (grid, hover/focus pseudo-classes, some positioning) need rework.
- **Visualizations are cheap to port:** the Progress tab uses **no chart library and no `<svg>`/`<canvas>`** — graphs are CSS/flexbox primitives, which become RN `View`s with flexbox natively (only gradient/bar effects might want `react-native-svg` / `expo-linear-gradient`).
- `tokens.css` → `tokens.ts` (JS token objects) feeding both NativeWind and web Tailwind.

**Genuinely new/native:** the voice stack (`useSpeechRecognition`/`useDictation`/`VoiceInput`) → a native speech module (also the on-ramp to the live-listening coach), and eventual metronome/audio playback.

**Effort shape (shape, not a quote):** foundation (Expo app, nav, clerk-expo, NativeWind + tokens.ts) ~1 wk · primitives ~1–1.5 wk · feature screens (the bulk) ~3–5 wk · native voice parity ~few days · App Store prep ~1–2 wk calendar. **≈ 6–9 engineering weeks** to a polished TestFlight of today's features. Largest unknowns: feature-component complexity (forms, gestures) and any CSS effects that don't translate.

### Part 2 — Structuring for parallel web + React Native

**Decision: a shared non-UI core package + separate view layers per platform (NativeWind on RN). Do *not* adopt full-universal UI (React Native Web + Tamagui/Solito).** Universal-UI's payoff is "build the UI once," but it requires re-platforming the *working* web app onto RNW and constrains web to what RNW supports — and the payoff evaporates here because the surfaces will **diverge** (mobile gains audio-heavy coach screens web won't have; web leans toward desktop planning/history). Divergent surfaces → share the core, not the UI.

**Adopt now (cheap, and it improves the current web app too):**

1. **Extract `packages/core`** — `types.ts`, `api.ts`, all pure-logic libs, and their vitest suites (not `useApi.ts`, which stays a per-platform wrapper). Both `frontend/` (Next) and a new `mobile/` (Expo) import it. The repo is **not** a JS workspace today (no root `package.json`; `backend/` is Python and `frontend/` is the only npm package), so this includes **establishing the workspace** (npm or pnpm) and adding `mobile/` and `packages/core` alongside `frontend/`.
2. **Single-source the design tokens** — `tokens.css` → `tokens.ts`, consumed by web Tailwind config *and* NativeWind.
3. **Keep components thin over the core** — logic in hooks/core, presentational components "dumb" — so porting a screen to RN is a re-skin, not a re-derivation.
4. **Build the voice/audio engine as a portable native/C++ core from day one**, so it serves RN, a later full-native option, and a possible server-side path.
5. **New-feature workflow:** build core + web now, stub the RN screen; re-skin against the known-good core when mobile catches up.

This dovetails with the two foundational tickets: #331 (Clerk Core 3) folds into RN foundation; #324's provider abstraction is the voice interface that belongs in `packages/core`.
