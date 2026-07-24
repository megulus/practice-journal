# Kantelo — Frontend Implementation Plan

> **📦 Historical — Phase 0 completed July 2026.** This plan guided the phased frontend rebuild (Phase 0 scaffolding: design tokens, theme provider, app shell, UI primitives, and the per-screen retones landed in PRs #203–#210). It's retained as a record of the rebuild's rationale and phase structure, **not** as an active task list. For current status and what's next, see the GitHub Project board; for what's built, see git history. Post-Phase-0 feature work is tracked in its own issues.

> Phased build plan for the Kantelo frontend. Each phase is independently shippable and testable. Hand this to Claude Code alongside the product spec, schema/API doc, and design tokens doc. The backend is built separately — see kantelo-schema-api.md for the full API contract that the frontend consumes.

**Last updated:** March 2026
**Stack:** Next.js 14 / React / TypeScript / Tailwind CSS (with CSS custom properties for design tokens) / Clerk

---

## How to use this document

Each phase has:
- **Goal** — what the user can do when this phase is done
- **Screens** — which screens to build, with references to the product spec sections
- **Components** — shared UI components introduced in this phase
- **API endpoints needed** — which backend endpoints this phase depends on (reference: kantelo-schema-api.md)
- **Acceptance criteria** — how to know it's done
- **Notes** — gotchas, stubs, and decisions

Work through the phases in order. Don't skip ahead — each phase builds on the previous one's components and patterns.

---

## Phase 0 — Scaffolding & design system

**Goal:** A running Next.js app with auth, theming, shared components, and a navigable shell. No feature screens yet — just the skeleton.

### Tasks

**0.1 — Project setup**
- Initialize Next.js 14 with App Router and TypeScript (or reconfigure existing frontend)
- Install and configure: Tailwind CSS, Clerk (Next.js SDK), any icon library (recommend Lucide React)
- Set up the `/src` directory structure:

```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/             # Clerk auth pages (sign-in, sign-up)
│   ├── (app)/              # Authenticated app shell
│   │   ├── layout.tsx      # Shell layout with nav
│   │   ├── today/
│   │   ├── progress/
│   │   ├── plans/
│   │   └── profile/
│   └── layout.tsx          # Root layout (Clerk provider, theme provider)
├── components/
│   ├── ui/                 # Design system primitives (Button, Card, Pill, etc.)
│   ├── layout/             # Shell, BottomNav, SideNav
│   └── [feature]/          # Feature-specific components (added in later phases)
├── lib/
│   ├── api.ts              # API client (fetch wrapper with Clerk token)
│   ├── tokens.css          # CSS custom properties (design tokens)
│   └── utils.ts            # Shared utilities
├── hooks/                  # Custom React hooks
└── types/                  # TypeScript type definitions
```

**0.2 — Design tokens as CSS**
- Create `tokens.css` with all CSS custom properties from the design tokens doc (section 7)
- Both light and dark mode token sets: `:root` for light, `[data-theme="dark"]` for dark
- Include the full section color pool as CSS variables or a TypeScript constant
- Load fonts: IBM Plex Sans (400, 500, 600) for the UI, Finlandica (700) for the wordmark only
- Import in root layout

**0.3 — Theme provider**
- Build a `ThemeProvider` component that:
  - Reads `prefers-color-scheme` on first visit
  - Stores preference in localStorage
  - Sets `data-theme` attribute on `<html>`
  - Provides a toggle function via React context
- Wire into root layout

**0.4 — API client**
- Create a typed fetch wrapper that:
  - Prepends the API base URL
  - Attaches the Clerk session token via `useAuth()` / `getToken()`
  - Handles JSON serialization/deserialization
  - Returns typed responses
  - Handles errors consistently (401 → redirect to sign-in, 4xx/5xx → throw)

**0.5 — Auth integration**
- Configure Clerk middleware for protected routes
- Set up sign-in/sign-up pages (Clerk's prebuilt components are fine for v1)
- Auto-create user record on first authenticated API call (`GET /api/user/me`)

**0.6 — App shell & navigation**
- Build the authenticated layout with:
  - **Bottom tab nav** (mobile/tablet, < 1024px): Today (`Sun`), Progress (`Activity`), Plans (`LayoutGrid`), Profile (`User`) from Lucide React. Active state uses `primary` color.
  - **Side nav** (desktop, ≥ 1024px): same links plus profile section at bottom. "Kantelo" wordmark at top in Finlandica Bold 20px (see design tokens doc §8 for all wordmark sizing contexts).
  - Active route detection via `usePathname()`
- Build responsive container: single centered column (max 520px) with optional secondary panel placeholder at desktop widths
- Each tab should render a placeholder page ("Today — coming soon") so navigation works end to end

**0.7 — UI primitives**
Build these shared components based on the design tokens doc (section 6). Every component must work in both light and dark mode.

| Component | Props | Notes |
|-----------|-------|-------|
| `Button` | variant (primary, secondary, danger, ghost), fullWidth, size | Primary = teal fill. Ghost = text only. |
| `Card` | variant (default, suggestion, coaching, hint) | Default = white bg. Suggestion = amber. Coaching = teal. Hint = recessed with left border. |
| `Pill` | active, variant (instrument, sectionType), color | Instrument pills toggle. Section type pills use pinned/pool colors. |
| `SectionPip` | color | 8px colored circle. |
| `Checkbox` | checked, onChange | 18px, teal when checked. |
| `TimeStepper` | value, onChange, min, max | +/- buttons with centered value. |
| `RatingChevrons` | value (-1, 0, 1, null), onChange | Three chevron buttons with directional labels. |
| `ProgressBar` | value (0–1) | 3px track with teal fill. |
| `RotationBar` | total, current | Segmented bar. |
| `StatCard` | label, value, unit? | For session summary and insights. |
| `TextInput` | Standard input props + recessed variant | |
| `TextArea` | Standard textarea props + recessed/italic variant | For notes fields. |
| `VoiceInput` | onTranscript, attachedTo (ref to text field) | Mic button wrapping Web Speech API. Manages recording state, transcription, permissions. Hidden when API unavailable. See design tokens §6 for full spec. |

### Acceptance criteria
- [ ] App runs locally, navigates between all four tabs
- [ ] Clerk auth works — unauthenticated users see sign-in
- [ ] Light/dark mode toggle works and persists
- [ ] All UI primitives render correctly in both modes
- [ ] VoiceInput component activates speech recognition, transcribes into a text field, and hides gracefully when Web Speech API is unavailable
- [ ] API client successfully calls `GET /api/user/me` with auth token
- [ ] Desktop layout shows side nav; mobile shows bottom tabs

---

## Phase 1 — The core loop (Today → Active session → Summary)

**Goal:** A user with an existing template can open the app, see today's practice plan, start a session, rate exercises and add notes, finish, and see a summary with a coaching suggestion and reflection prompt. This is the MVP.

### Screens

**1.1 — Today tab** (product spec §5.1)
- Instrument pill toggle (top) — fetches from `GET /api/instruments`
- Pre-session suggestion card — fetches from `GET /api/suggestions/pre-session?instrument_id=X`
- Rotation bar and session label
- Plan card (focus text, plan source, section type pills)
- "Start session" button → calls `POST /api/practice/start`, navigates to active session
- **"Repeat last session" shortcut** — shown when `repeat_session` is non-null in the `GET /api/today` response (i.e., the user's most recent completed session differs from the current rotation pick). Tapping starts a new log with that session's `template_session_id`.
- **"Choose a different session" picker** — expandable list from `all_sessions` in the Today response, letting users pick any session in the rotation (not just the next one up).
- "Practice off-plan" link → calls `POST /api/practice/start` with no template, navigates to active session
- **No-plan state:** if the selected instrument has no active template, show a simplified view with "Practice off-plan" as the primary action and a prompt to create a plan. (Quick-start wizard is Phase 4.)
- Data source: `GET /api/today`

**1.2 — Active session** (product spec §5.2)
- Top bar: session focus title + "End session" link
- Progress indicator: text + progress bar + running total
- Section cards with:
  - Section header (pip, name, time stepper) + **section-level actions**: "Mark all done" (checks all boxes, doesn't set ratings) and "Skip section" (marks entire section as skipped). Styled as small text links in `text-secondary`.
  - Exercise rows (checkbox, name, metadata, rating chevrons)
  - **Smart tempo defaults:** if a block was practiced previously, pre-fill its tempo from the last session's logged value. Show pre-filled tempo as muted text, switching to primary color on confirm/adjust.
  - Per-exercise "add note" toggle → inline textarea **with mic button for voice input** (Web Speech API). Mic button is more prominent than the text field — voice is the primary input path, typing is fallback.
  - In-the-moment suggestion hint cards — fetches from `GET /api/suggestions/in-session/{logId}`
  - **Quick-add block:** compact text input at the bottom of each section ("Add something else...") with enter-to-submit and mic button. Creates a freeform block inline with no metadata. "Browse library" link next to it for the full library experience.
- Completed sections: reduced opacity, logged vs. planned time reference
- Bottom: session notes textarea (with mic button), "Finish session" button, "+ Add a section" link
- State management: local React state for the session, synced to backend via:
  - `PUT /api/practice/{logId}/blocks/{blockLogId}` on rating/note changes
  - `PUT /api/practice/{logId}/sections/{sectionLogId}` on time stepper changes / mark-all-done / skip
  - `POST /api/practice/{logId}/sections/{sectionLogId}/blocks` for quick-add blocks
  - `POST /api/practice/{logId}/finish` on finish
- Debounce writes — don't fire an API call on every keystroke in notes fields. Sync on blur or on a 1-second debounce.

**1.3 — Session summary** (product spec §5.3)
- Stat cards: minutes, exercises completed, day streak
- "What you practiced" list with colored dots, rating labels, and per-exercise notes
- Coaching suggestion card (from `POST /api/practice/{logId}/finish` response)
- Guided reflection prompt (from finish response) with text field **and mic button for voice input**
- "Done" button → saves reflection via `PATCH /api/practice/{logId}/reflection`, navigates to Today tab
- "Edit this session" link → navigates back to active session in edit mode

### Components introduced

| Component | Notes |
|-----------|-------|
| `InstrumentToggle` | Horizontal pill row, fetches instruments, controls selected instrument state |
| `SuggestionCard` | Dismissible. Calls `POST /api/suggestions/dismiss` on dismiss. |
| `PlanCard` | Focus text, source line, section pills, wraps data from Today endpoint |
| `SectionCard` | Collapsible. Header + body. Handles completed state (opacity fade). Includes "Mark all done" and "Skip section" actions. |
| `ExerciseRow` | Checkbox + name + meta + rating + note toggle. The most complex component. Shows smart tempo default if available. |
| `VoiceInput` | Reusable mic button component wrapping Web Speech API. Attaches to any text field. Manages recording state, transcription, and error handling (browser support, mic permissions). Falls back gracefully if speech recognition is unavailable. |
| `QuickAddBlock` | Compact text input with enter-to-submit and mic button. Creates freeform blocks inline. |
| `HintCard` | In-session suggestion, rendered below relevant exercise rows |
| `ReflectionPrompt` | Rotating question + textarea with mic button + subtext |
| `SessionSummaryStats` | Horizontal row of StatCards |
| `ExerciseResultRow` | Colored dot + name + rating label + optional note |

### API endpoints needed
- `GET /api/instruments` — instrument list for pill toggle
- `GET /api/today` — today context (instruments due, current sessions)
- `GET /api/suggestions/pre-session?instrument_id=X` — pre-session suggestion
- `POST /api/practice/start` — start session (scaffolds logs from template)
- `GET /api/practice/{logId}` — fetch in-progress session
- `PUT /api/practice/{logId}/sections/{sectionLogId}` — update section duration/completed
- `PUT /api/practice/{logId}/blocks/{blockLogId}` — update rating/notes/completed
- `GET /api/suggestions/in-session/{logId}` — in-session suggestions
- `POST /api/practice/{logId}/finish` — finish session, get summary + suggestion + reflection prompt
- `PATCH /api/practice/{logId}/reflection` — save reflection response
- `POST /api/suggestions/dismiss` — dismiss a suggestion
- `GET /api/settings` — user settings (for suggestions preference check)

### Acceptance criteria
- [ ] Today tab shows the correct plan for the selected instrument
- [ ] Instrument toggle switches the displayed plan
- [ ] Pre-session suggestion appears and is dismissible
- [ ] "Repeat last session" shortcut appears when appropriate and starts a new log correctly
- [ ] "Start session" creates a practice log and opens the active session with sections/blocks pre-populated from the template
- [ ] Exercises can be checked off, rated, and annotated with notes
- [ ] Voice input (mic button) works on all text fields — per-exercise notes, session notes, reflection prompt
- [ ] Voice input falls back gracefully when Web Speech API is unavailable (mic button hidden or disabled)
- [ ] Quick-add block creates a freeform block inline when a name is entered
- [ ] "Mark all done" checks all exercise boxes in a section without setting ratings
- [ ] "Skip section" marks the section and all its blocks as skipped
- [ ] Smart tempo defaults pre-fill from the last session's logged tempo for repeat blocks
- [ ] Time steppers adjust section duration
- [ ] Completed sections fade and show logged vs. planned time
- [ ] In-the-moment suggestions appear for relevant exercises
- [ ] "Finish session" shows the summary with correct stats
- [ ] Coaching suggestion appears on the summary
- [ ] Reflection prompt appears with a rotating question; voice and text input both work; response saves correctly
- [ ] "Done" returns to Today tab with the rotation advanced
- [ ] "Practice off-plan" opens an empty session where sections/blocks can be added
- [ ] All screens work in both light and dark mode

---

## Phase 2 — Plans tab

**Goal:** A user can view their templates, create new ones, edit sessions/sections/blocks, and browse the curated block library.

### Screens

**2.1 — Template list** (product spec §5.4 intro)
- List of templates for the selected instrument, grouped by active/archived
- Each template row: name, session count, estimated total time, active badge
- Tap → navigate to template editor
- "+ New plan" button → creates template via `POST /api/instruments/{instrumentId}/templates`, navigates to editor
- Instrument pill toggle at top (same component as Today tab)

**2.2 — Template editor** (product spec §5.4)
- Template header: editable name, instrument, session count
- Session tabs: horizontal scrollable pills for each rotation session
- Active session view:
  - Focus description text input
  - Section cards (collapsible) with:
    - Section header (pip, name, estimated duration, section type)
    - Ordered block list with drag handles
    - Each block: name, duration, overflow menu (edit/delete)
    - "+ Add block" button → opens block library
  - "+ Add section" button (dashed border)
- Add/remove sessions from the rotation
- Reorder sections via drag-and-drop
- Template activation toggle (auto-deactivates the previous active template for this instrument)

**2.3 — Block library** (product spec §5.5)
- Opens as a sheet/modal when adding a block to a section
- Context header: "Add to [section name]"
- **"Recently used" section** at the top — blocks the user has practiced in their last few sessions on this instrument. Includes both curated blocks and ad hoc quick-add blocks from previous sessions. Data source: a `recent` param on the library endpoint, or a separate `GET /api/library/recent?instrument_id=X` endpoint.
- Search box (filters curated library, doubles as custom block input)
- Curated blocks organized by category, filtered by instrument + section type
- Each block: name, description, usage percentage
- Custom block creation: text input + "Add" button at bottom
- Data source: `GET /api/library/blocks?instrument=violin&section_type=scales&q=...`

### Components introduced

| Component | Notes |
|-----------|-------|
| `TemplateListItem` | Name, session count, active badge |
| `SessionTabs` | Scrollable pill row for rotation sessions |
| `SectionEditor` | Collapsible card with block list and add button |
| `BlockRow` | Name, duration, drag handle, overflow menu |
| `BlockLibrarySheet` | Modal/sheet with search, curated list, custom creation |
| `DragHandle` | For reordering blocks and sections |

### API endpoints needed
- `GET /api/instruments/{instrumentId}/templates` — template list
- `POST /api/instruments/{instrumentId}/templates` — create template
- `GET /api/templates/{id}` — full template detail
- `PATCH /api/templates/{id}` — update metadata, activate/deactivate
- `DELETE /api/templates/{id}` — soft-delete
- `POST /api/templates/{id}/sessions` — add session
- `PATCH /api/sessions/{id}` — update session
- `DELETE /api/sessions/{id}` — delete session
- `PUT /api/templates/{id}/sessions/reorder` — reorder sessions
- `POST /api/sessions/{sessionId}/sections` — add section
- `PATCH /api/sections/{id}` — update section
- `DELETE /api/sections/{id}` — delete section
- `PUT /api/sessions/{sessionId}/sections/reorder` — reorder sections
- `POST /api/sections/{sectionId}/blocks` — add block
- `PATCH /api/blocks/{id}` — update block
- `DELETE /api/blocks/{id}` — delete block
- `PUT /api/sections/{sectionId}/blocks/reorder` — reorder blocks
- `GET /api/library/blocks` — curated block library

### Acceptance criteria
- [ ] Template list shows all templates for selected instrument, grouped active/archived
- [ ] New template can be created with a name and auto-generated first session
- [ ] Template editor displays sessions as tabs, sections as collapsible cards, blocks as rows
- [ ] Focus description is editable and saves
- [ ] Sections and blocks can be added, edited, reordered, and deleted
- [ ] Block library opens in context, filters by instrument and section type, supports search
- [ ] Custom blocks can be created from the library
- [ ] Template can be activated/deactivated; activation auto-deactivates the previous one
- [ ] Changes persist across page refreshes
- [ ] Drag-and-drop reordering works for both sections and blocks

---

## Phase 3 — Progress tab

**Goal:** A user can review their practice history, browse insights (heatmap, comparisons, rating trend), and see pattern-level coaching suggestions.

### Screens

**3.1 — History sub-tab (default)** (product spec §5.7, History)
- Instrument pill toggle
- Sub-tabs: History (active) / Insights
- Pattern suggestion card at top
- Time filter pills: All sessions / This week / This month
- Session list: reverse-chronological, collapsed by default
  - Collapsed: date, session name, plan source, duration, exercise count
  - Expanded: block list with colored dots + ratings, per-exercise notes, session notes, reflection response
- Pagination: load more on scroll (cursor-based from API)
- Data source: `GET /api/progress/history?instrument_id=X&period=all&limit=20`

**3.2 — Insights sub-tab** (product spec §5.7, Insights)
- Pattern suggestion card at top
- Practice calendar heatmap (full year, teal intensity scale)
  - Data source: `GET /api/progress/insights/heatmap?instrument_id=X&year=2026`
  - Render client-side from flat day list
- This week vs. last comparison
  - Stat cards (days practiced, total time, delta)
  - Paired daily bar chart
  - Data source: `GET /api/progress/insights/comparison?instrument_id=X`
- Rating trend (stacked horizontal bars, 4 weeks)
  - Data source: `GET /api/progress/insights/ratings?instrument_id=X&weeks=4`
  - Plain-language summary below

### Components introduced

| Component | Notes |
|-----------|-------|
| `SubTabs` | Two-tab toggle (History / Insights) |
| `FilterPills` | Time range pills with active state |
| `SessionHistoryCard` | Expandable. Collapsed and expanded states. |
| `PracticeHeatmap` | Year grid, 7 rows × 52 cols. Teal intensity from duration. |
| `WeekComparison` | Two stat cards + paired bar chart |
| `RatingTrend` | Stacked horizontal bars + summary text |
| `PatternSuggestionCard` | Like SuggestionCard but blue info tint instead of amber |

### API endpoints needed
- `GET /api/progress/history` — paginated session history
- `GET /api/progress/history/{logId}` — session detail (expanded view)
- `GET /api/progress/insights/heatmap` — heatmap data
- `GET /api/progress/insights/comparison` — weekly comparison
- `GET /api/progress/insights/ratings` — rating trend
- `GET /api/suggestions/pre-session?instrument_id=X` — pattern-level suggestions (reuse pre-session endpoint with a `tier=pattern_level` param, or a dedicated endpoint — check backend implementation)

### Acceptance criteria
- [ ] History shows reverse-chronological session list for selected instrument
- [ ] Sessions expand to show full detail (blocks, ratings, notes, reflection)
- [ ] Time filter pills work (all / this week / this month)
- [ ] Pagination loads more sessions on scroll
- [ ] Insights tab shows practice heatmap with correct intensity mapping
- [ ] Weekly comparison shows accurate stats with delta
- [ ] Paired bar chart shows daily breakdown for both weeks
- [ ] Rating trend shows 4-week stacked bars with correct proportions
- [ ] Summary text updates based on the trend direction
- [ ] Pattern suggestion cards appear and are dismissible
- [ ] All charts and visualizations work in both light and dark mode

---

## Phase 4 — Profile, quick-start, and polish

**Goal:** Complete feature coverage. A new user can go from zero to practicing via the quick-start wizard. Settings are configurable. Freeform sessions are fully functional. Desktop secondary panel is populated.

### Screens

**4.1 — Profile tab** (product spec §5.8)
- Account header (avatar, name, email, "Manage account" link → Clerk)
- Instruments list with inline practice frequency pills
- Add instrument
- Coaching suggestions preference (radio: all / fewer / off)
- Preferences (default session duration, week starts on)
- Sign out
- Data sources: `GET /api/instruments`, `GET /api/settings`, `PATCH /api/settings`

**4.2 — Quick-start wizard** (product spec §5.6)
- Step 1: instrument selection grid
- Step 2: goal text input (becomes plan name)
- Step 3: session area checkboxes (warm-up, scales, repertoire, etc.)
- Step 4: time budget buttons + generated plan preview
  - "Start practicing" → creates template + starts session
  - "Customize this plan" → opens template editor
  - "Save plan and practice later" → saves without starting
- Bottom nav appears on step 4 only
- "Skip setup" link on step 1 → freeform session

**4.3 — Freeform session polish**
- Ensure "+ Add a section" works in the active session (opens a section type picker, then the block library)
- Ensure freeform sessions save into the same history and analytics
- Freeform sessions show "Off-plan · no template" in history

**4.4 — Desktop secondary panel**
- Today tab: streak card, mini month heatmap, recent sessions
- Progress tab: supplementary content based on active sub-tab
- Plans tab: quick stats for selected template
- Uses the same data endpoints as the main content — no new APIs needed

**4.5 — Polish pass**
- Focus states on all interactive elements (2px primary outline)
- Touch target audit (minimum 44px)
- `prefers-reduced-motion` support
- Loading states for all API calls (skeleton screens or subtle spinners, not blank screens)
- Error states (API failures, empty states)
- Optimistic updates where appropriate (rating taps should feel instant)
- Session auto-save: if the user closes the tab mid-session, the in-progress log is preserved and resumable next time they open Today

### Components introduced

| Component | Notes |
|-----------|-------|
| `FrequencyPills` | Inline practice frequency selector for instrument cards |
| `RadioGroup` | For coaching suggestions preference |
| `WizardStep` | Shared wrapper for quick-start wizard steps |
| `InstrumentGrid` | Grid of instrument pills for wizard step 1 |
| `AreaCheckboxes` | Checkbox list for wizard step 3 |
| `TimeBudgetButtons` | Four time options for wizard step 4 |
| `PlanPreview` | Generated plan preview for wizard step 4 |
| `DesktopSecondaryPanel` | Conditional panel with per-tab content |
| `StreakCard` | Current streak display |
| `MiniHeatmap` | Compact month view for desktop sidebar |
| `RecentSessionsList` | 3–5 most recent sessions, compact format |

### API endpoints needed
- `GET /api/settings` — user settings
- `PATCH /api/settings` — update settings
- `POST /api/instruments` — add instrument (wizard + profile)
- `PATCH /api/instruments/{id}` — update frequency, display order
- `DELETE /api/instruments/{id}` — remove instrument
- `POST /api/instruments/{instrumentId}/templates` — create template from wizard
- (All Phase 1–3 endpoints for the features they power)

### Acceptance criteria
- [ ] Profile tab displays all instruments with correct frequency settings
- [ ] Practice frequency can be changed inline
- [ ] Coaching suggestions preference saves and takes effect (hides/shows suggestions appropriately)
- [ ] Default session duration and week start day save and affect relevant features
- [ ] Quick-start wizard flows from instrument → goal → areas → time → plan preview
- [ ] Generated plan preview is reasonable (balanced time allocation across selected areas)
- [ ] "Start practicing" creates a template and drops into an active session
- [ ] "Skip setup" goes to a freeform session
- [ ] Freeform sessions allow adding sections and blocks on the fly
- [ ] Desktop secondary panel shows contextual content per tab
- [ ] All interactive elements have visible focus states
- [ ] Loading and error states are handled gracefully
- [ ] Session auto-save preserves in-progress sessions across tab closures

---

## Implementation notes

### State management
- Use React Server Components for initial data fetching where possible (template list, session history, settings)
- Use client components for interactive screens (active session, template editor)
- No global state library needed for v1 — React context for theme and auth, local state + `useSWR` or `useQuery` for data fetching
- The active session screen is the most stateful — consider a `useReducer` for managing the session state (sections, blocks, ratings, notes, completion)

### API integration pattern
- Define TypeScript types for all API responses in `/types/`
- Create typed hook wrappers: `useInstruments()`, `useToday(instrumentId)`, `usePracticeSession(logId)`, etc.
- Mutations via a `useMutation`-style pattern (function that calls the API client, returns loading/error state)
- Optimistic updates for rating chevrons and checkboxes — update local state immediately, sync to backend in background

### Testing strategy
- Vitest + React Testing Library for component unit tests
- Focus tests on: rating interaction logic, time stepper math, section completion state, color pool assignment, theme switching
- Integration tests for the active session flow (start → rate → finish → summary)
- Visual regression tests are nice-to-have but not blocking for v1

### What to stub if backend isn't ready
- The suggestions engine endpoints can return empty responses — the UI should handle "no suggestion" gracefully
- The curated block library can be seeded with a static JSON file
- The Today "due" logic can be simplified to "show all instruments" if the backend isn't computing due dates yet
- Analytics endpoints can return sample data for development

---

## Phase dependency map

```
Phase 0 (scaffolding)
  └── Phase 1 (core loop) ← This is the MVP
        ├── Phase 2 (plans)
        └── Phase 3 (progress)
              └── Phase 4 (profile, wizard, polish)
```

Phases 2 and 3 can be built in parallel after Phase 1. Phase 4 depends on both being complete (the wizard creates templates from Phase 2, and the desktop panel includes Progress data from Phase 3).
