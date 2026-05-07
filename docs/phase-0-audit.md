# Phase 0 — Scaffolding & design system audit

> Audit of the current frontend against [Phase 0 of the frontend plan](kantelo-frontend-plan.md). Becomes the source of truth for sequencing the Phase 0 backfill PRs.
>
> **Why this exists:** the rebuild skipped Phase 0 and went straight to features (#144 Today, #145 Active session, #166 Plans editor). Every screen so far has been built against stock Tailwind (indigo `primary-*`, neutral grays, ad-hoc rounded corners) instead of the warm-stone + teal token system specified in [`kantelo-design-tokens.md`](kantelo-design-tokens.md). This audit catalogs the gap so we can fill it deliberately.

**Last updated:** 2026-05-06

---

## Legend

- ✅ done — matches what Phase 0 specifies
- ⚠️ partial — exists but needs migration to tokens / new structure
- ❌ missing — has to be added from scratch
- 🔄 wrong — exists but conflicts with the spec; needs replacement

---

## 0.1 — Project setup

| Item | Status | Notes |
|------|--------|-------|
| Next.js 14 App Router + TypeScript | ✅ | |
| Tailwind CSS configured | ⚠️ | `tailwind.config.ts` uses stock indigo `primary` palette; needs replacement with token-driven theme |
| Clerk Next.js SDK | ✅ | |
| Lucide React icon library | ❌ | Not installed. Current code uses unicode glyphs (`▲`, `▼`, `✕`) and emoji-like characters |
| `/src` directory structure (per plan) | 🔄 | Flat structure: `app/today`, `app/plans`, `components/*`. Plan calls for `app/(auth)/`, `app/(app)/`, `components/ui/`, `components/layout/`, `components/[feature]/`, `lib/`, `hooks/`, `types/`. We have `lib/` only |

**What's needed:**
- Install `lucide-react`
- Reorganize `app/` into `(auth)` and `(app)` route groups (Clerk auth pages → `(auth)`, everything else → `(app)`)
- Create `components/ui/`, `components/layout/`, `hooks/`, `types/` (currently types live in `lib/types.ts` — fine to keep but plan suggests a `types/` dir)
- Replace `tailwind.config.ts` with a token-driven theme (see 0.2)

---

## 0.2 — Design tokens as CSS

| Item | Status | Notes |
|------|--------|-------|
| `lib/tokens.css` (or equivalent) with all tokens | ❌ | No CSS custom properties at all |
| Light + dark token sets | ❌ | Single (light, indigo-based) Tailwind theme |
| IBM Plex Sans loaded (400, 500, 600) | ❌ | Default sans-serif stack |
| Finlandica loaded (700) for wordmark | ❌ | No wordmark anywhere in the app |
| Tokens imported in root layout | ❌ | |

**What's needed:**
- Create `src/styles/tokens.css` (or `src/lib/tokens.css`) with every token from [`kantelo-design-tokens.md` §2-§6](kantelo-design-tokens.md), organized into `:root` (light) and `[data-theme="dark"]`
- Add Google Fonts links for IBM Plex Sans (3 weights) and Finlandica (700) in root layout, or use `next/font`
- Update `tailwind.config.ts` to consume the CSS variables: `colors: { 'page-bg': 'var(--page-bg)', primary: 'var(--primary)', ... }`. This way Tailwind utility classes (`bg-page-bg`, `text-primary`, etc.) automatically respond to dark mode without conditional logic.
- Wire `tokens.css` import into `app/layout.tsx`

**Decision needed:** are the section type pinned/pool colors (warm-up, cool-down, blue, purple, etc.) defined as Tailwind-extended colors, or kept as a TypeScript constant `SECTION_COLOR_POOL` and applied via inline style? The plan suggests the latter — "an ordered array in the frontend".

---

## 0.3 — Theme provider

| Item | Status | Notes |
|------|--------|-------|
| `ThemeProvider` component | ❌ | |
| `prefers-color-scheme` detection | ❌ | |
| localStorage persistence | ❌ | |
| `data-theme` attribute on `<html>` | ❌ | |
| Toggle function via React context | ❌ | |
| Wired into root layout | ❌ | |

**What's needed:** build from scratch per plan §0.3.

**Note on persistence:** the spec says "stored in settings." That implies the user's theme preference goes through `GET/PATCH /api/settings`, not just localStorage. localStorage is the fast path for unsigned users / first paint; settings is the durable cross-device store. Plan ordering: build with localStorage first (Phase 0), wire to settings in Phase 4 alongside the Profile preferences.

---

## 0.4 — API client

| Item | Status | Notes |
|------|--------|-------|
| Typed fetch wrapper with API base URL | ✅ | `lib/api.ts` `createAuthenticatedAPI` |
| Clerk JWT injected via `useAuth().getToken()` | ✅ | `lib/useApi.ts` |
| JSON serialization | ✅ | |
| Typed responses | ✅ | All ~50 methods return typed promises |
| 401 redirects to sign-in | ⚠️ | Needs verification — the `f<T>` helper throws an `APIError` but I don't see an explicit 401 → sign-in redirect |
| 4xx/5xx handling | ⚠️ | Throws `APIError`; consumers handle it locally with try/catch and `setError` |

**What's needed:** small audit + likely a 401 interceptor that redirects to `/sign-in`. Otherwise mostly done.

---

## 0.5 — Auth integration

| Item | Status | Notes |
|------|--------|-------|
| Clerk middleware for protected routes | ✅ | `src/middleware.ts` |
| Sign-in / sign-up pages | ✅ | `app/sign-in/[[...sign-in]]/page.tsx`, `app/sign-up/[[...sign-up]]/page.tsx` |
| Auto-create user on first authenticated `GET /api/user/me` | ❓ | Need to check whether the backend already does this on any endpoint, or whether the frontend has to gate every page on a `/me` call |

**What's needed:** confirm backend behavior; if it doesn't auto-create, add a one-shot `GET /api/user/me` call at app boot (root layout client-side effect, or middleware). This is currently latent: there's no path from "Clerk-authenticated user" to "Kantelo user record" except by calling endpoints that side-effect-create the user.

---

## 0.6 — App shell & navigation

| Item | Status | Notes |
|------|--------|-------|
| Authenticated layout | ✅ | `components/AppShell.tsx` |
| Bottom tab nav | ⚠️ | Exists (`BottomNav.tsx`) but: (a) uses unicode/emoji icons, not Lucide; (b) order and labels match plan but no token-driven colors |
| Side nav (≥1024px) | ❌ | Nothing for desktop; everything is mobile-only |
| Wordmark in side nav (Finlandica 20px) | ❌ | |
| Active route detection via `usePathname()` | ✅ | |
| Responsive container (max 520px main, optional secondary panel) | ❌ | Most screens use `max-w-lg` (~512px) but no secondary panel logic |
| Each tab renders something | ⚠️ | Today (real), Progress (placeholder), Plans (real after #166), Profile (placeholder) |

**What's needed:**
- Replace bottom nav icons with Lucide (`Sun`, `Activity`, `LayoutGrid`, `User`)
- Build desktop side nav with wordmark
- Build responsive container that switches between bottom-nav-only (mobile) and side-nav + secondary-panel (desktop)
- Apply tokens (`nav-active`, `nav-inactive`)

---

## 0.7 — UI primitives

The biggest chunk. Plan calls for a `components/ui/` directory with these primitives, all token-driven, all light + dark.

| Component | Status | Notes |
|-----------|--------|-------|
| `Button` (primary, secondary, danger, ghost) | ❌ | Inline button styles everywhere; no shared component |
| `Card` (default, suggestion, coaching, hint) | ❌ | Cards are inline `bg-white rounded-xl border` everywhere |
| `Pill` (instrument toggle, generic) | ❌ | Inline pill styles in BottomNav, Today, Plans, SessionTabs |
| `SectionPip` (8px colored circle) | ❌ | |
| `Checkbox` (18px, teal when checked) | ❌ | Active session uses ad-hoc `<button role="checkbox">` markup |
| `TimeStepper` | ⚠️ | Exists at `components/TimeStepper.tsx` — ad-hoc styling, needs migration to tokens + relocation to `components/ui/` |
| `RatingChevrons` | ⚠️ | Exists at `components/RatingChevrons.tsx` — ad-hoc styling, needs migration |
| `ProgressBar` | ❌ | |
| `RotationBar` | ❌ | |
| `StatCard` | ❌ | Session summary uses inline divs |
| `TextInput` (standard + recessed) | ❌ | Inline `<input className="...">` everywhere |
| `TextArea` (standard + recessed/italic) | ❌ | |
| `VoiceInput` (mic button + Web Speech API) | ❌ | **Missing entirely.** Spec calls voice input the *primary* path for notes, session notes, and reflection prompt — typing is the fallback. Currently only typing is supported. |

**Plus from `ConfirmDialog` / `AddBlockSheet` work in #169:**

| Component | Status | Notes |
|-----------|--------|-------|
| `Dialog` / `Sheet` primitive | ❌ | Tracked in #173 (filed as tech debt). Should land as part of Phase 0 since these are foundational. |
| `AutoSaveInput` / `useAutoSaveField` | ❌ | Tracked in #171 (filed as tech debt). Same — foundational. |

---

## Cross-cutting items not in 0.1–0.7 but required

These are mentioned in [`kantelo-frontend-plan.md`](kantelo-frontend-plan.md) acceptance criteria and elsewhere; they aren't part of any specific sub-task but block "Phase 0 done":

| Item | Status | Notes |
|------|--------|-------|
| Light + dark mode toggle visible somewhere | ❌ | The plan implies a toggle exists; Profile is the natural home in Phase 4, but for Phase 0 acceptance ("Light/dark mode toggle works and persists"), we need a temporary toggle (e.g., in the header during dev) |
| All UI primitives render correctly in both modes | ❌ | Depends on 0.2 + 0.7 |
| API client successfully calls `GET /api/user/me` with auth token | ⚠️ | Method exists if 0.5 is wired; not currently auto-called |
| Desktop layout shows side nav; mobile shows bottom tabs | ❌ | Depends on 0.6 |

---

## Existing screens that need retoning

After Phase 0 lands, these screens need a sweep to swap stock Tailwind for token-driven utility classes / `components/ui/` primitives:

- `app/today/page.tsx` (built in #144)
- `app/session/[id]/page.tsx` (built in #145, repertoire support added)
- `app/session/[id]/summary/page.tsx` (built in #145)
- `app/session/start/page.tsx` (built in #144)
- `app/plans/page.tsx` and `app/plans/[id]/page.tsx` (built in #166)
- `components/AppShell.tsx`, `components/BottomNav.tsx`
- `components/RepertoireBlock.tsx`, `components/SectionCard.tsx`, `components/BlockRow.tsx`, `components/AddBlockSheet.tsx`, `components/SessionTabs.tsx`
- `components/RatingChevrons.tsx`, `components/TimeStepper.tsx` (move to `components/ui/` + retone)
- `components/ConfirmDialog.tsx` (rebuild on top of new `Dialog` primitive — see #173)

This is the "design debt" pile. Doing it incrementally per-screen is fine; doing it all in one PR is risky (huge diff, hard to review).

---

## Proposed sequencing of Phase 0 PRs

The sub-tasks 0.1–0.7 don't all have to be separate PRs. Some are cheap and can ride together; others are large enough to deserve their own.

Recommended grouping:

1. **PR 1 — Foundation** (0.1 + 0.2)
   - Install `lucide-react`
   - Create `tokens.css` with full light + dark token sets
   - Add font loading (Plex + Finlandica)
   - Replace `tailwind.config.ts` with token-driven theme
   - Reorganize `app/` into `(auth)` and `(app)` route groups
   - Add the empty `components/ui/`, `components/layout/`, `hooks/`, `types/` directories
   - **No screen retoning yet** — existing screens keep working with their stock Tailwind classes (since CSS variables fall back to indigo via the new theme, or we set `tailwind.config.ts` to map old class names to new token vars).
   - **Risk:** existing screens look broken or weird until they're retoned. Worth a moment of jank.

2. **PR 2 — Theme provider + dark mode wiring** (0.3)
   - `ThemeProvider` with localStorage persistence
   - Temporary toggle button (header or floating)
   - Wire `data-theme` to `<html>`
   - Acceptance: toggling switches the page background color (everything else still hardcoded — that's fine, validates the wiring)

3. **PR 3 — UI primitives (basic set)** (0.7, batch 1)
   - `Button`, `Card`, `Pill`, `TextInput`, `TextArea`, `Checkbox`, `SectionPip`, `ProgressBar`, `RotationBar`, `StatCard`
   - Move `TimeStepper`, `RatingChevrons` into `components/ui/` and retone
   - No `VoiceInput` yet (more involved)

4. **PR 4 — Dialog / Sheet primitive** (#173)
   - `Dialog` (centered modal) and `Sheet` (bottom sheet) sharing focus-trap, scroll-lock, backdrop dismiss
   - Refactor `ConfirmDialog` and `AddBlockSheet` onto it

5. **PR 5 — AutoSaveInput primitive** (#171)
   - `useAutoSaveField` hook + `AutoSaveInput` / `AutoSaveTextarea` components
   - Replaces ad-hoc `useState(initial)` patterns in BlockRow, SectionCard, plan editor inline subcomponents

6. **PR 6 — App shell** (0.6)
   - Lucide nav icons
   - Desktop side nav with Finlandica wordmark
   - Responsive container (mobile bottom nav, desktop side nav)

7. **PR 7 — VoiceInput** (0.7, batch 2)
   - Mic button component wrapping Web Speech API
   - Recording state, transcription, fallback for unsupported browsers, permission denied handling

8. **PR 8 — Auto-create user on /me** (0.5)
   - One-shot `GET /api/user/me` at app boot
   - 401 interceptor in API client → redirect to sign-in (0.4 audit item)

9. **PR 9+ — Screen retoning** (per-screen, can be parallelized)
   - Today, Active session, Session summary, Plans list, Plans editor, etc.
   - Each PR limited to one or two screens to keep diffs reviewable

After all of these, **Phase 1 acceptance** can be re-evaluated and any drift from the plan (active session missing "Mark all done", "Skip section", quick-add block, smart tempo defaults) gets its own follow-up.

---

## Resolved decisions

1. **Section colors** — Hybrid: define each color's pillBg/pillText/pip as CSS custom properties in `tokens.css` (light + dark), with a TypeScript `SECTION_COLOR_POOL` constant in `lib/section-colors.ts` referencing those vars (e.g. `pillBg: 'var(--section-blue-pill-bg)'`). A small `getSectionColor(sectionType, displayOrder)` helper centralizes the pinned/pool assignment rule. Components apply via inline `style={{}}`.
2. **Theme toggle home** — Profile preferences row, three options (Match system / Light / Dark), default Match system. Spec patched in PR #175 (kantelo-product-spec.md §5.8). First-paint resolution via inline `<head>` script reading localStorage with `prefers-color-scheme` fallback; settings is the cross-device source of truth (backend ticket #176). No persistent toggle in nav.
3. **Route reorg** — Done as a standalone PR #177 before the Foundation PR. Mechanical changes kept separate from foundational design work.
4. **Retone order** — Today, then Active session, then everything else. Visual retoning kept separate from any functional changes — spec-missing functional pieces become their own follow-up tickets.

---

## Per-screen retone strategy

For each existing screen, decide whether to **retone in place** (lift code, swap classes/components for tokens/primitives, preserve current functional scope) or **rebuild from scratch** (delete and rewrite against the spec). Spec-missing functional pieces always become separate follow-up tickets — they are not part of the retone PR.

### Today (`src/app/(app)/today/page.tsx`)

**Spec reference:** kantelo-product-spec.md §5.1, docs/wireframes/today-tab.png, kantelo-frontend-plan.md Phase 1 task 1.1.

**Strategy:** ✅ **Retone in place.**

**Rationale:** Component decomposition (`TodayPage` → `InstrumentToggle`, `SuggestionCard`, `DueInstrumentCard`, `NotDueCard`, `EmptyState`) maps cleanly to the spec layout. All gaps are token swaps + small additions, not architectural.

**In scope for the retone PR:**
- Swap stock Tailwind classes for token-driven utilities (page bg, text colors, borders, radii)
- Adopt new `Button`, `Card`, `Pill` primitives from Phase 0
- Replace inline SVG with Lucide icons in suggestion card (`AlertCircle`, `X`)
- Add a small `RotationDots` component for the "Today's practice" header (currently missing — spec calls for "filled dots showing position in the rotation cycle")
- Section pills use the section color system (pinned for warm-up/cool-down, pool for everything else) per spec §2

**Out of scope (separate tickets):**
- Empty state → quick-start wizard (already #151)
- Mobile header with Kantelo wordmark + avatar (lives in AppShell — covered by PR 6 in the sequencing)
- "Choose a different session" picker (mentioned in plan, not in spec §5.1) — file as a small follow-up if we want it
- Active-session resume banner (we added it; not in spec but useful — keep it, just retone it)

### Active session (`src/app/(app)/session/[id]/page.tsx`)

**Spec reference:** kantelo-product-spec.md §5.2, docs/wireframes/active-session.png + active-session-repertoire-default.png + active-session-repertoire-whole-piece.png, kantelo-frontend-plan.md Phase 1 task 1.2.

**Strategy:** ✅ **Retone in place + extract subcomponents.**

**Rationale:** Existing decomposition is correct; a from-scratch rewrite would risk regressing the load-bearing patterns from #145 (`apiRef`, `pendingFlushes`, `repertoireBlockIds` refs, atomic finish flush). Extracting the seven inline components into `components/session/*.tsx` files is the natural moment to do it — readability win, matches the plan's `components/[feature]/` convention.

**In scope for the retone PR:**
- Token swaps everywhere (page bg, card bg, borders, text colors, radii)
- Adopt new `Card`, `Button`, `Checkbox`, `TextArea`, `RatingChevrons`, `TimeStepper` primitives from Phase 0
- Section pip uses the section color system (pinned + pool per spec §2) — replaces ad-hoc `bg-orange-400`/`bg-blue-400`/etc. in `SectionTypeIcon`
- Lucide icons (`Check` inside checkbox, `X` for close, `MoreHorizontal` for overflow)
- Add "X min (plan: Y)" reference text on completed sections (currently just opacity fade)
- Replace `window.confirm` for End session with `ConfirmDialog` (or eventual `Dialog` primitive from #173)
- Extract `SectionCard`, `BlockRow`, `QuickAddBlock`, `AddSectionButton`, `SessionNotes`, `SectionTypeIcon` into `components/session/*.tsx` files
- Retone `RepertoireBlock.tsx` in the same PR (splitting would leave a half-retoned screen — the components touch each other)

**Out of scope (separate tickets — file before the retone PR opens):**
- **Voice input** on every text field (per-block notes, session notes, quick-add, add-section name, reflection) — depends on Phase 0 `VoiceInput` primitive (PR 7)
- **In-the-moment suggestions** display (`GET /api/suggestions/in-session/{logId}` returns data the frontend never fetches) — depends on a `HintCard` primitive
- **Smart tempo defaults** — pre-fill tempo field from `last_tempo_bpm`, shown muted, switches to primary on confirm/adjust (currently shown as static "Last tempo: X bpm" text)
- **"Browse library" link** next to quick-add per spec §quick-add
- **Progress label** "what was just completed" (e.g., "Scales complete") — small but functional
- Add-section freeform picker — already #168 design ticket; the current 7-button picker will be replaced when that lands

### Session summary (`src/app/(app)/session/[id]/summary/page.tsx`)

**Spec reference:** kantelo-product-spec.md §5.3, docs/wireframes/session-summary.png, kantelo-frontend-plan.md Phase 1 task 1.3.

**Strategy:** ✅ **Retone in place.**

**Rationale:** Small file (199 lines), structurally close to spec. The major missing piece — the "What you practiced" per-exercise list — is already tracked as **#165** (deferred polish from #146) and will be built on top of the new primitives once they land. The current aggregated rating-count display ("Step forward: 3, Steady: 1") is not in spec but stays in place during the retone; #165 replaces it later.

**In scope for the retone PR:**
- Token swaps (page bg, card bg, text colors, borders, radii)
- Adopt `StatCard` and `Card` (coaching variant) primitives from Phase 0
- Coaching suggestion card uses `--coaching-bg` / `--coaching-text` tokens (currently uses ad-hoc `bg-teal-50`)
- Reflection text field uses tokenized text input
- Add **"Edit this session"** button (spec calls for it; small functional add — Link back to `/session/[id]`)
- Add the subtitle line under "Session complete" (e.g., "Slow practice on mvt. II · Violin") — currently missing

**Out of scope (separate tickets):**
- **"What you practiced" per-exercise list** — already #165
- **Voice input** on the reflection text field — depends on Phase 0 `VoiceInput` primitive

### Plans list (`src/app/(app)/plans/page.tsx`)

**Spec reference:** kantelo-product-spec.md §5.4 (intro), kantelo-frontend-plan.md Phase 2 task 2.1.

**Strategy:** ✅ **Retone in place + small structural add.**

**Rationale:** Built in #166. Decomposition is fine; spec calls for one structural addition (active/archived grouping based on `is_active`) which is small enough to ride along with the retone.

**In scope for the retone PR:**
- Token swaps (page bg, card bg, text colors, borders, radii)
- Adopt `Button`, `Card`, `Pill` primitives
- Group templates into "Active" and "Archived" sections (where archived = `is_active === false`)
- Per-row metadata: add **session count** and **estimated total time** (sum of section durations across all template sessions) to each row — spec calls for both
- Active badge → tokenized teal pill

**Out of scope (separate tickets):**
- True archive/unarchive workflow if `is_active` proves insufficient (file if needed; current schema only has the boolean)

### Plans editor (`src/app/(app)/plans/[id]/page.tsx`)

**Spec reference:** kantelo-product-spec.md §5.4, kantelo-frontend-plan.md Phase 2 task 2.2, docs/wireframes/template-editor.png.

**Strategy:** ✅ **Retone in place.**

**Rationale:** Built in #166 with a deliberate retone-friendly structure (`SessionTabs`, `SectionCard`, `BlockRow`, `AddBlockSheet`). All gaps are token swaps + small visual adjustments.

**In scope for the retone PR:**
- Token swaps everywhere
- Adopt `Button`, `Card`, `Pill`, `Checkbox`, `TextInput`, `TextArea` primitives
- Section header: add section pip (using the section color system) and (eventually) section-type indicator — depends on #168 picker landing
- Block row: replace the inline `X` delete with an overflow menu (`MoreHorizontal` Lucide icon) — spec calls for an edit/delete overflow menu
- AddBlockSheet uses tokenized colors and Lucide icons
- ConfirmDialog migrates to the eventual `Dialog` primitive from #173

**Out of scope (separate tickets — already filed):**
- **Repertoire blocks in the editor** + spot management drawer — already **#167**
- **Drag-and-drop reorder** (chevrons are deliberate; #166 deferred this) — file follow-up if/when chevrons feel clunky in real use
- **Section type picker** — already **#168** design ticket; until that lands, sections stay hardcoded to `'other'`

---

## Acceptance for "Phase 0 done"

Mirrors the plan's own acceptance criteria, restated here as a checklist for tracking:

- [ ] App runs locally, navigates between all four tabs (Today, Progress, Plans, Profile)
- [ ] Clerk auth works — unauthenticated users see sign-in
- [ ] Light/dark mode toggle works and persists
- [ ] All UI primitives in `components/ui/` render correctly in both modes
- [ ] `VoiceInput` activates speech recognition, transcribes into a text field, and hides gracefully when Web Speech API is unavailable
- [ ] API client successfully calls `GET /api/user/me` with auth token; user record is auto-created if not present
- [ ] Desktop layout shows side nav with Finlandica wordmark; mobile shows bottom tabs with Lucide icons
- [ ] All existing screens (Today, Active session, Session summary, Plans list, Plans editor) have been retoned to use tokens + UI primitives
