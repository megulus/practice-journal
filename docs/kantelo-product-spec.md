# Kantelo — Product Specification

> A practice coach for musicians. Practice smarter. Not just more.

This document captures the product decisions, information architecture, user flows, and UX design for Kantelo. It is intended as a reference for developers (human or AI) building or iterating on the application.

**Last updated:** August 2026
**Domain:** kantelo.app
**Origin:** The name comes from the Finnish *kantele*, the mythic stringed instrument from the Kalevala epic. When Väinämöinen played the kantele, every creature in nature fell silent to listen. That's what great practice leads to.

---

## 0. How to read this document

This spec describes the full product vision. **Not all of it ships in v1.** Features carry inline status tags, and **§12 is the authoritative v1 scope boundary** — a single table of every feature and its status. When §12 and a body section disagree, §12 wins.

| Tag | Meaning |
|-----|---------|
| **[v1]** | Ships in v1. Free forever. |
| **[undecided]** | Designed and specced, but the v1 decision is pending. Do not build without confirming. |
| **[post-v1]** | Not in v1. Free when it ships. |
| **[post-v1 — Pro]** | Not in v1. A paid capability when it ships. Must not appear in v1 in any form. |
| **[v1 — launch prerequisite]** | Must be live on launch day, but is not a user-facing product feature — observability, analytics, mobile packaging, data deletion. These have no screen spec; see §12.7. |

**The core pricing invariant:** *everything in v1 is free forever; not everything free forever is in v1.* Kantelo's paid tier is strictly additive — nothing shipped in v1 is ever moved behind a paywall. The practical consequence for implementation is that **anything added to v1 is permanently free**, so scope decisions and pricing decisions are the same decision. See `kantelo-gtm-positioning-pricing.md` for the reasoning.

v1 contains **no billing, payments, subscription, or entitlement logic of any kind.**

---

## 1. Product overview

Kantelo is a full-stack web application that helps musicians track, structure, and improve their practice habits. It combines structured practice plans with session logging, analytics, and a rules-based coaching suggestions engine.

### What Kantelo is not

- **Not a learn-to-play app.** Kantelo is for people who already play an instrument but practice inconsistently or ineffectively. It does not teach music fundamentals, provide real-time audio feedback, or gamify learning with points and levels.
- **Not a blank journal.** Unlike simple practice trackers, Kantelo is opinionated — it tells you what to practice today, tracks how it went, and surfaces coaching insights.
- **Not a studio management tool.** Scheduling, billing, and general-purpose messaging between teachers and students are out of scope. Teacher integration (future) is scoped to practice-related workflows only.

### Positioning

Kantelo fills the gap between "learn to play" apps (Yousician, Simply Piano) and passive practice journals (Modacity, Andante). It is "the first intelligent practice coach for musicians" — a Strava for music practice.

### Brand personality

Warm coach + aspirational athlete. Encouraging but not soft, motivating but not cheesy. Takes the musician's craft seriously.

---

## 2. Target audience

### Primary: The "serious-casual" musician

Past the beginner phase — can play their instrument, maybe took lessons as a kid or is self-taught, but has hit a plateau or practices inconsistently. Not conservatory-track, but cares about getting better.

Examples: adult returners, self-taught guitarists who've plateaued, hobbyists practicing 3–5 times a week, amateur players in community ensembles.

Core problem: "I don't know how to practice." They sit down, noodle around, and walk away feeling vaguely unsatisfied.

### Secondary: Students with teachers

A teacher can assign/customize practice templates for a student. Student session logs flow back to the teacher. Teacher can leave contextual feedback scoped to specific exercises or sessions. This is future scope but should be considered in data modeling.

### Tertiary: Practice buddies / peer accountability

Lightweight social features (shared streaks, practice leaderboards among friends). Future scope.

---

## 3. Tech stack

- **Frontend:** Next.js 14 / React / TypeScript
- **Backend:** FastAPI / Python
- **Database:** PostgreSQL
- **Auth:** Clerk
- **Local dev:** Docker Compose
- **CI:** GitHub Actions
- **Migrations:** Alembic
- **Testing:** Vitest (frontend), pytest (backend)

---

## 4. Information architecture

Kantelo uses a flat, tab-based navigation with four top-level sections. This replaces the current deep hierarchy (home → instrument → feature → sub-screen).

```
Bottom tab navigation
├── Today (default landing)
│   ├── Active session (plan view + inline logging)
│   └── Session summary (post-practice results)
├── Progress
│   ├── History (default sub-tab)
│   │   └── Session list (expandable)
│   └── Insights (sub-tab)
│       ├── Practice calendar heatmap
│       ├── Time comparisons
│       └── Rating trend
├── Plans
│   ├── Template list
│   ├── Template editor
│   └── Day / block editor
└── Profile
    ├── Instruments
    ├── Repertoire (per instrument)
    ├── Settings (including suggestions opt-out)
    └── Account
```

### Key structural decisions

- **Instrument management moves to Profile.** It is part of setup/settings, not the daily workflow. For multi-instrument users, a lightweight pill toggle on the Today tab switches context.
- **Plan viewing and practice logging are merged** into a single "active session" flow. There is no separate "log practice" screen.
- **Freeform logging** is accessed via a "Practice off-plan" link on the Today tab, which opens the same active session screen but empty — the user adds sections as they go.
- **The plan-less user** (no templates yet) sees the Today tab adapted as a quick-start wizard.
- **Repertoire is a first-class concept** owned by the instrument, not by individual templates. See §6.5.

---

## 5. Screen specifications

### 5.1 Today tab

The default landing screen. Answers: "What should I practice right now?"

**Layout (user with active plan):**

1. **Instrument toggle** (top) — pill-style selector showing all instruments. Tapping switches the view. Only visible for multi-instrument users.
2. **Pre-session suggestion** **[v1]** (optional) — a warm, contextual coaching nudge. Max one per session. Example: "Your scales coverage has dropped off — consider adding a scales block today." Styled as a subtle card with an amber accent, dismissible. See section 7 for suggestion tier details.
3. **"Today's practice" header** with rotation progress indicator (filled dots showing position in the rotation cycle).
4. **Plan card** containing:
   - **Day focus** (large, primary text) — the user-written description of this session's focus. Example: "Slow practice on movement II". This is the headline.
   - **Plan source** (smaller, secondary text) — the plan name, session number, and estimated duration. Example: "Learn the Bruch concerto — session 3 of 7 · ~25 min"
   - **Section pills** — compact tags showing what the session includes (Warm-up, Scales, Repertoire, Cool-down).
5. **"Start session" button** — primary action, full-width, prominent.
6. **"Repeat last session" shortcut** **[v1]** — shown below the start button when the user's most recent session on this instrument used the same template session that's currently queued. Tapping starts a new log pre-populated from the same template session, skipping the Today tab entirely. This is a fast path for users in a daily routine. If the rotation has advanced to a different session, this shortcut does not appear. Repertoire blocks are repeated with their full spot list from the previous session — the user can deselect any spot in the active session before rating.
7. **"Practice off-plan" link** — secondary, below the button. Opens an empty active session for freeform logging.

**Layout (user with no plan — first-run / quick-start wizard):**

See section 5.6 (Quick-start wizard).

### 5.2 Active session

The core interaction screen. The practice plan *is* the logging interface — the user works through their plan and annotates it as they go.

**Top bar:** Session focus title (e.g., "Slow practice on mvt. II") + "End session" link.

**Progress indicator:**
- Text: "2 of 5 sections done" with a label for what was just completed.
- Visual: horizontal progress bar (fills as sections are completed).
- Running total: "Total so far: 6 min" — updates as sections are completed and times are adjusted.
- **No elapsed-time clock or stopwatch.** Time is handled through pre-filled section durations (see below). This is a deliberate decision to avoid practice anxiety.

**Section display:**

Each section (warm-up, scales, repertoire, etc.) contains:

- **Section header** with name and time stepper.
- **Time stepper:** a compact +/- control pre-filled from the plan's estimated duration. Users can adjust in 1-minute increments if their actual time differed. Default case (plan times are roughly right) requires zero interaction.
- **Section-level actions** in the header: "Mark all done" (checks all exercise checkboxes but does not set ratings — the user still rates individually if they choose) and "Skip section" (marks the entire section as skipped, sets completed=false on the section log and all its block logs). These save 3–5 taps per section in the common cases. Styled as small text links in `text-secondary`, not prominent buttons.
- **Exercise rows** within the section, each containing:
  - Checkbox (tap to mark done)
  - Exercise name and metadata (tempo, key, etc.). **Smart tempo defaults** **[v1]**: if the user practiced this specific block in a previous session, the tempo field pre-fills from their last logged tempo. The suggestions engine can also recommend bumping tempo (see section 7). Pre-filled tempos are shown as muted text and become primary-colored once confirmed or adjusted.
  - Rating indicator (see below)
- **Repertoire blocks** **[v1]** are a special variant of exercise row. Instead of a single checkbox and rating, a repertoire block displays the piece name as a header and a list of **spot rows** beneath it. Each spot row has its own checkbox, name, optional location, and rating chevrons. The block's default spot list (from the template) is pre-populated and pre-checked. The user can:
  - Deselect any spot for today only (uncheck before rating)
  - Tap "+ Add spot" at the bottom of the block to create a new spot inline (single-line input, voice-enabled, with an "Add to rotation" toggle defaulted to on)
  - Tap the piece header to log against the whole piece without spots, on a pressed day
  - The repertoire picker surfaces "Recently practiced spots" (from the user's last few sessions on this piece) above any spots not in today's default list, so a one-tap re-add of yesterday's work is always available

**Completed sections** fade back (reduced opacity) so visual focus falls on what's next. They show logged time vs. plan time as a quiet reference (e.g., "3 min (plan: 2)").

**Rating indicator (chevrons):**

Three circular buttons per exercise, each containing a directional arrow. The rating measures **trajectory, not quality** — "how did this compare to last time?" rather than "how good was that?" This framing is deliberate: musicians are notoriously self-critical, and asking them to declare victory ("Nailed it") skews data negative and makes logging feel punishing. Asking about direction is an observation, not a boast.

- **Down chevron** = Step back (amber background when selected: #FAEEDA fill, #BA7517 stroke) — harder than last time, or something regressed
- **Horizontal line** = Steady (gray background when selected) — about the same as last time
- **Up chevron** = Step forward (teal background when selected: #E1F5EE fill, #0F6E56 stroke) — improvement, even small

Directional shape encodes meaning independently of color (accessible to colorblind users). A text label ("Step back", "Steady", "Step forward") appears on selection for the first few uses. The framing is consistent from the first session onward — even without a prior session to compare against, users can interpret the scale against their own internal baseline.

**Per-exercise notes:**

Each exercise row (and each spot row within a repertoire block) includes a small "add note" link that expands an inline text field below the exercise. Notes are scoped to a specific block log (or spot log), not the whole session. This is where users write observations like "intonation still shaky in the top octave of mm. 24–28." The suggestions engine can surface these back in future sessions ("Last session you noted..."). The note field is optional and collapsed by default — zero friction for users who just want to tap ratings and move on.

**Voice input** **[v1]****:** Every text field in the active session — per-exercise notes, session notes, the post-session reflection prompt, and spot creation/editing fields — has a microphone button as the primary input affordance, more prominent than the text field itself. Tapping the mic activates the browser's speech recognition (Web Speech API) and transcribes directly into the field. This is critical for reducing friction: musicians have their hands full. Voice is the primary input path for notes; typing is the fallback.

**Platform warning — do not use feature detection.** The Web Speech API is *exposed but non-functional* inside WKWebView ([WebKit #239816](https://bugs.webkit.org/show_bug.cgi?id=239816)); Apple has not enabled it outside Safari. `'webkitSpeechRecognition' in window` therefore returns `true` where the API does nothing, so the "hide the mic when unavailable" fallback specified in the design tokens doc silently fails. This affects **every iOS in-app browser today** (Instagram, Slack, Gmail link previews) and will affect the Capacitor build. `VoiceInput` requires a **provider abstraction**: one interface, a Web Speech implementation and a native-plugin implementation, selected by platform check rather than feature check. See `kantelo-capacitor-spike.md`. The mic button should use the `Mic` Lucide icon at 20px in `text-link` color, positioned to the right of the text field or as a floating button within it.

**In-the-moment suggestions** **[v1]****:**

Small, expandable hint cards that appear inline below specific exercises. Drawn from the user's own history. Example: "Last session you noted intonation was shaky in the top octave." Styled as a subtle card in the secondary background color.

**Bottom of screen:**
- Notes textarea: "Notes — breakthroughs, challenges, ideas..." (with voice input mic button)
- "Finish session" button (primary)
- "+ Add a section" link (freeform escape hatch — add unplanned work mid-session)

**Quick-add block:**

Each section includes a compact text input at the bottom of its block list: a single-line field with placeholder "Add something else..." and an enter-to-submit action. Typing a name (or dictating via mic) and submitting creates a new block inline with no metadata — just a name, a checkbox, and rating chevrons, ready to be used. This is the fast path for ad hoc additions mid-session (e.g., "I also ran through the cadenza"). The full block library is still accessible via a "Browse library" link next to the quick-add input. Quick-add blocks are saved to the session log as freeform blocks (block_id is null) and appear in session history like any other block.

### 5.3 Session summary

The post-practice reward screen. Answers: "How did that go?"

**Stat cards** (horizontal row):
- Minutes (total productive practice time, summed from section durations)
- Exercises completed
- Day streak

**"What you practiced" list:**

Each exercise shown with a colored dot and its rating in words:
- Teal dot + "Step forward" — exercise where the user improved
- Gray dot + "Steady" — about the same as last time
- Amber dot + "Step back" — something regressed
- Light gray dot + "Skipped" — exercise not completed

Repertoire blocks display the piece name as a header followed by the practiced spots, each with their own dot and rating. Per-exercise notes from the active session are displayed inline below the relevant exercise or spot, providing context for the rating.

**Post-session suggestion:**

A coaching insight card (teal background) that combines backward-looking reflection and forward-looking motivation. The card should use the directional rating language. Example: "You've practiced 4 of the last 7 days — one more this week matches your goal. Your Bruch first page is trending forward for the second session in a row. For mm. 17–32, try an even slower tempo next time — sometimes a step back means you're ready to go deeper."

**Guided reflection prompt:**

Below the coaching card, a rotating question with a single optional text field. The prompt encourages noticing over evaluating — it should work equally well whether the session went great or rough. The answer is stored on the PracticeLog alongside session-level notes.

Prompt rotation pool (11 prompts):

- *Progress-oriented:* "What felt different today?" / "What was easier than you expected?" / "Did anything click that hadn't before?"
- *Forward-looking:* "What do you want to focus on next time?" / "If you had 10 more minutes, what would you spend them on?"
- *Awareness-building:* "What did you notice about your playing today?" / "Where did your attention go during the session?" / "Was there a moment you want to remember?"
- *Honest check-in:* "What was the hardest part of today's session?" / "Did anything surprise you?" / "How does your body feel after playing?"

Styled with a brief subtext: "Optional — a moment to notice what you might forget later." Placeholder text models a good answer (e.g., "Felt more relaxed in the left hand. Maybe the new warm-up is helping..."). The reflection text field includes a mic button for voice input (same pattern as active session notes — see §5.2, Voice input).

Rotation rules: the app should avoid showing the same prompt twice in a row and should not repeat any of the last 3 prompts shown. No sophisticated algorithm needed — a shuffle with recency exclusion is sufficient.

**Actions:**
- "Done" button (primary) — returns to Today tab.
- "Edit this session" button (secondary) — allows corrections to logged data.

### 5.4 Template editor

Accessed from the Plans tab. Where users build and refine their practice plans.

**Template header:** Plan name, instrument, and number of sessions in the rotation.

**Session tabs:** Horizontal scrollable pills for each session in the rotation. Users can name their sessions (e.g., "Technique focus", "Repertoire deep dive"). Default for a single-session plan: "Your session" (no tab visible). When a second session is added, the app prompts the user to name both sessions.

**Session rotation model:**
- Default to a single session (no rotation concept visible).
- Rotation is introduced later, either when the user adds a second session in the editor, or via a suggestion from the coaching engine ("You've been doing the same routine for 3 weeks — alternating focus sessions can help you cover more ground").
- Sessions are named, not numbered. Named sessions ("Bow work", "Repertoire day") are more informative than "Day 1, Day 2" throughout the app. Fallback if unnamed: "Session 1, Session 2."

**Day focus field:** A text input at the top of each session's view. The text entered here becomes the headline on the Today tab. Placeholder: "e.g. Slow practice on movement II".

**Section cards:** Each section (warm-up, scales, etc.) is a collapsible card containing:
- Section header with color pip and total time
- Ordered list of blocks with drag handles for reordering
- Each block shows name, duration, and an overflow menu (edit/delete)
- "+ Add block" button at the bottom of each section (opens block library)

**"+ Add section" button** below all section cards (dashed border style).

**Repertoire blocks in the editor.** When adding a block to a section, the block library (§5.5) gains a "Your repertoire" tab alongside the curated and recent tabs. This tab lists pieces from the current instrument's repertoire library, each expandable to show its active spots. Selecting a piece adds a repertoire block to the section. The block's default spot list can then be edited inline: add spots from the piece's library, create new spots (which write to the piece library), or remove spots from the default list (which does not retire them at the piece level — they remain available for ad-hoc selection in sessions). Spots can also be retired from the piece library directly via an overflow menu.

**Template duplication.** Templates can be duplicated from the template editor. When duplicating, a small confirmation dialog appears: "Copy spots from the original plan? You can always edit them later." defaulted to "Yes, copy spots." When yes, the new template's repertoire blocks reference the same Pieces and Spots as the original — both templates contribute to the same spot histories. When no, repertoire blocks are created with empty default spot lists for the user to populate.

### 5.5 Block library

Opens when user taps "+ Add block" within a section. Context-aware — the header shows which section the block is being added to.

**Search box** at the top doubles as the custom block creator. Typing filters the curated library; if no match, the custom input field at the bottom pre-fills.

**Curated library:** Organized by category, filtered and sorted by relevance to the current section and instrument. Each library item shows:
- Block name
- Brief description
- Popularity indicator (percentage of users with this instrument who include this block) — crowd-sourced social proof

**Categories shown:**
- **"Recently used"** — blocks the user has practiced in their last few sessions on this instrument. Shown first, above curated categories. Includes both curated blocks and ad hoc quick-add blocks from previous sessions. This builds muscle memory — if you added "cadenza" as a quick-add block last session, it shows up at the top of the library next time, ready to be tapped rather than typed.
- **"Your repertoire"** — pieces from the current instrument's repertoire library, each expandable to show active spots. Selecting a piece adds a repertoire block; selecting a specific spot adds a repertoire block pre-scoped to that spot. This tab is hidden if the user has no pieces yet for this instrument.
- "Popular for [instrument] [section type]" — the most relevant curated blocks
- "Technique and etudes" — standard exercise literature
- "Other" — improvisation, sight-reading, ear training, etc.

**Custom block creation:** Text input at the bottom with an "Add" button. Always available as a fallback. Users can type any block name.

**Hybrid model:** For v1, the app provides a curated starter set of common block types per instrument. Users can create custom blocks freely. Over time, popular custom blocks can be promoted into the curated set.

### 5.6 Quick-start wizard

Shown on the Today tab for users with no active plan. Five steps, each a single screen. Goal: zero to practicing in under a minute.

**Step 1 — Instrument:**
"What do you play?" with a grid of common instrument pills (Violin, Viola, Cello, Piano, Guitar, Flute, Voice, Other...). Single selection. "Skip setup" link in top bar for users who want to go straight to freeform.

**Step 2 — Goal:**
"What are you working on right now?" with a free-text input field. Placeholder: "e.g. Bruch Violin Concerto, sight-reading..." This becomes the plan name. "I'm not sure yet — just get me started" link skips this step and generates a generic plan.

**Step 3 — Session areas:**
"What should a session include?" with checkbox rows for practice areas: Warm-up, Scales and technique, Repertoire, Sight-reading, Ear training, Cool-down. Warm-up, Scales, Repertoire, and Cool-down are pre-selected as defaults.

**Step 4 — Anything you're working on?**
A single optional question: "Anything you're working on right now?" with a free-text field (voice-enabled), placeholder "e.g. Bruch concerto, Autumn Leaves, fiddle tune you're learning..." and a prominent "Skip — I'll add later" link. Whatever the user enters becomes a single Piece in the new instrument's repertoire library, and the generated plan's repertoire block defaults to that piece with no spots. If skipped, the repertoire block is generic and the user creates a piece the first time they actually practice. No movement field, no spots, no metadata at this step — just a name. The wizard's job is to get them practicing in under a minute, and asking "what are you working on" is a natural question that doesn't feel like data entry.

**Step 5 — Time and preview:**
"How much time today?" with four time-budget buttons (15, 30, 45, 60 min). The app generates a balanced plan preview based on selected areas and time budget. Preview shows each section with name, brief description, and time allocation. "Customize this plan" link opens the template editor. "Start practicing" button drops into the active session. "Save plan and practice later" saves without starting.

The bottom nav appears on step 5 (user is now "in" the app). Steps 1–4 do not show the nav.

### 5.7 Progress tab

The Progress tab uses two sub-tabs: **History** (default) and **Insights**. Both sub-tabs share the instrument pill toggle at the top (same behavior as the Today tab — switches all content to the selected instrument).

**Pattern-level suggestion cards** **[post-v1 — Pro]** appear at the top of both sub-tabs, styled with an info-blue accent to distinguish them from the amber pre-session suggestions on the Today tab. The suggestion content can differ between sub-tabs: History might surface session-specific patterns ("You tend to skip cool-down sections"), while Insights might surface frequency patterns ("Your average session is 15 min shorter on weekends"). Suggestions are dismissible and follow the same server-side tracking as other suggestion tiers.

#### History sub-tab (default) **[v1]**

Session history is free, unlimited, and permanent — there is no session cap, no age cutoff, and no paywall on a user's own practice record, ever. See §0.

A reverse-chronological list of past sessions. Each session card shows:

**Collapsed state (default):**
- Date (e.g., "Sat, Mar 21")
- Session name / day focus (e.g., "Technique focus")
- Plan source and rotation position (e.g., "Learn the Bruch concerto · session 2 of 7") — or "Off-plan · no template" for freeform sessions
- Total duration
- Exercise count
- Expand/collapse affordance

**Expanded state:**
- All collapsed-state info, plus:
- Block list with colored dots matching the rating scheme (teal = step forward, gray = steady, amber = step back, light gray = skipped) and rating label in words. Repertoire blocks display the piece name with their practiced spots nested beneath.
- Per-exercise (and per-spot) notes displayed inline below the relevant row (if any were logged)
- Session-level notes (if any)
- Reflection prompt response (if any)

**Filtering:** A row of time-range pills (All sessions / This week / This month) sits below the suggestion card. Instrument filtering is handled by the pill toggle at the top. Session type filtering (template vs. freeform) and date range filtering can be added in a later release.

#### Insights sub-tab

Four components, each answering a distinct question about the user's practice.

**Insights is pricing-critical — read this before scoping.** The rating trend (component 3) is the capability the entire free/Pro boundary rests on: the free tier shows a short window, and Pro extends it. If the rating trend does not ship in v1, the free tier is structured plans plus logging, which is indistinguishable from a passive practice tracker, and there is no conversion path at all. **Components 1, 2, and 3 are all [v1] and none of them are droppable.**

Every Insights time window below is deliberately chosen. **Do not extend any of them in v1** — the longer horizons are the Pro tier, and per the invariant in §0, anything shipped in v1 becomes permanently free.

**1. Practice calendar heatmap** **[v1]**

A GitHub-style contribution grid showing practice activity over the year. Rows are days of the week (Mon–Sun), columns are months. Cell intensity maps to practice duration (not just binary practiced/didn't-practice), using the teal ramp: empty (no practice), light, medium, dark, full. A legend ("Less → More") sits below the grid.

This is the primary consistency motivator — the user can see the pattern of their week/month at a glance. It answers: "Am I showing up?"

**Scope note — years.** v1 shows the full current year, and a user with prior data may browse a past year (their own history is always free; see §0). What is **[post-v1 — Pro]** is *year-over-year comparison*: overlay views, deltas, and summary stats like "you practiced 40 more days than last year." The `GET /api/progress/insights/heatmap` endpoint already accepts a `year` param, so a comparison UI is a small change — which is exactly why it must be explicitly excluded from v1 rather than left to implementer discretion.

**2. Time comparisons ("This week vs. last")** **[v1]**

Two side-by-side stat cards showing:
- Days practiced (with delta, e.g., "+1 day vs. last week")
- Total practice time

Below the stat cards, a paired bar chart shows daily breakdown for the current and previous week (teal bars = this week, gray bars = last week). This makes weekly patterns visible at a glance.

Answers: "Am I practicing consistently?"

**3. Rating trend ("How it's going")** **[v1 — 4 weeks only]**

Stacked horizontal bars showing the step back / steady / step forward distribution for each of the last 4 weeks. Uses the same amber / gray / teal color scheme as the rating chevrons. A plain-language summary sits below the chart (e.g., "Trending up — more exercises moving forward each week").

This is the key differentiator from other practice trackers — it directly answers: "Am I getting better?" No other app in the competitive landscape visualizes improvement trajectory this way.

**Scope note — window.** v1 is capped at 4 weeks. The `GET /api/progress/insights/ratings` endpoint takes a `weeks` param defaulting to 4; v1 must not expose a control that raises it. **[post-v1 — Pro]:** longer horizons (months, quarters), and per-piece / per-spot rating trends.

Four weeks of rating data is deliberately not enough to answer the question conclusively — that is the design. The free tier poses the question Kantelo exists to answer; Pro answers it.

**4. Pattern-level suggestion card** **[post-v1 — Pro]** (described above, shared with History sub-tab)

**Deferred to a later release** **[post-v1]****:** Section-type distribution (where time goes), per-exercise drill-down views, and exercise-level progress timelines. These are valuable but not emotionally compelling enough for v1 — they're "hmm, neat" rather than "yes, I'm getting better."

### 5.8 Profile tab

A single scrollable page (no sub-tabs — not enough content to justify them) with four sections:

**Account header:**

Compact row showing avatar (initials circle), display name, email, and a "Manage account" link that opens Clerk's account management UI. Clerk handles authentication, password changes, and profile editing.

**My instruments:**

Each instrument is a card showing:
- Instrument name with an "edit" link (opens detail view for removing the instrument, viewing its plans, etc.)
- Practice frequency setting as inline pills: Daily / Few times a week / Weekly / Occasionally. Adjustable directly on the card — no drill-down needed. This setting calibrates the suggestions engine and Today tab instrument rotation (see section 6).
- A **"Repertoire" link** **[v1]** that opens the instrument's repertoire library: a list of all pieces (active and any with retired-only spots), each expandable to show its spots, with affordances for renaming pieces, retiring/un-retiring spots, deleting, and viewing per-spot history. This is the canonical place for managing repertoire outside of the active session and template editor.
- Summary line: number of active plans, number of pieces in the repertoire library, and last practice date (e.g., "1 active plan · 3 pieces · last practiced today")

"+ Add instrument" button below the instrument cards (dashed border style, matching the template editor's "+ Add section" pattern).

**Coaching suggestions:** **[v1]**

Three radio button options with descriptions:
- **All suggestions** — "Before, during, and after practice." Pre-session nudges, in-the-moment coaching, and post-session reflection are all active.
- **Fewer suggestions** — "Only in session summaries." Disables pre-session nudges and in-the-moment coaching. Post-session coaching cards remain.
- **Off** — "No coaching suggestions anywhere." All suggestion tiers disabled.

An earlier revision of this spec called for a two-state toggle in v1, on the assumption that post-session was the only live tier. **That is superseded** — pre-session and in-the-moment both ship in v1 (§7), so the three options are behaviorally distinct and the radio is correct.

Note the "Fewer" description omits the Insights tab: pattern-level suggestions are **[post-v1 — Pro]**, so there is nothing on Progress for this setting to govern in v1. Restore the fuller wording when that tier ships.

**Preferences:**

Slim for v1:
- **Default session duration** — used by the quick-start wizard when generating a plan. Options: 15, 30, 45, 60 min.
- **Week starts on** — affects the practice calendar heatmap and weekly comparisons in Insights. Options: Monday / Sunday.

Additional preferences can slot in here as needed in later releases.

**Sign out** button at the bottom (danger-colored text, no fill).

---

## 6. Multi-instrument model

Multi-instrument users see a pill toggle at the top of the Today tab. Each instrument has its own templates, session history, repertoire library, and analytics.

### Practice frequency setting

Each instrument has a configurable expected cadence (daily, a few times a week, weekly, occasionally). This setting controls:

- **Today tab:** Only instruments that are "due" based on their cadence and last practice date are surfaced. A horn practiced weekly doesn't show up every day.
- **Suggestions engine:** Consistency nudges respect the expected cadence. "It's been 3 days since you last practiced piano" only fires if piano is set to daily or a-few-times-a-week, not weekly.
- **Rotation across instruments:** For alternating instruments (e.g., violin and viola on alternate days), the Today tab can show both when they're due on the same day.

---

## 6.5 Repertoire: Pieces and Spots

Repertoire is a first-class concept in Kantelo, separate from templates. Each instrument has its own **repertoire library** — a growing list of pieces the user is currently working on, each with a list of spots (the sub-units they actually practice).

**Why this exists.** Real practice rarely targets a whole piece or movement. It targets "the first page of the Bruch," "the B section," "trouble spots in the development." If these are logged as freeform strings, the coaching engine can't tell that "Bruch trouble spots" on Monday and "trouble spots in Bruch first half" on Wednesday are the same thing — and the rating trend chart, the most distinctive feature in Insights, becomes useless for repertoire. Modeling pieces and spots as reusable entities is what makes coaching at the repertoire level possible.

### Pieces

A Piece is whatever the user thinks of as a unit of repertoire — a classical concerto, a jazz standard, a fiddle tune, an etude, an original composition. Pieces are scoped to a single instrument: "Bach D minor partita" on violin and "Bach D minor partita" on viola are two different pieces, because the technical challenges, fingerings, and trouble spots are unrelated. A piece has a name, an optional composer/source field, and a list of spots.

Pieces are created lazily — typically the first time the user adds a repertoire block to a template or starts logging against a piece in an active session. There is no separate "add a piece" workflow; pieces appear when needed.

### Spots

A Spot is a sub-unit of a piece that the user actually practices. Spots are user-defined and named in the user's own vocabulary: "first page," "development," "the lyrical bit," "trouble spots mm. 24–28," "the B section," "head," "solo changes." A spot has:

- A **name** (required, free text)
- An optional **location** (free text — see "Location field" below)
- An **active/retired** state
- A history of block logs across all sessions where it was practiced

Spots persist at the piece level, not the template level. This means a spot's history follows the piece across template changes — if the user retires their current Bruch plan and starts a new one six months later, the spots and their history are still there.

### Location field

The location field is a single optional free-text input on each spot. The app does not require or parse a particular format — users may write "mm. 24–28," "page 3," "letter C to E," "the second half," or leave it blank. Coaching does not depend on parsing this field.

To make location entry low-friction without imposing structure, the input shows a row of **smart-insert chips** below the field: `mm.` / `page` / `letter` / `to` / `–`. Tapping a chip inserts the text at the cursor position. Voice input (mic button) is available on the field as well.

The chip order adapts to the user's history: chips the user has used recently surface first. A user who consistently writes "mm. 24–28" sees `mm.` first; a user who writes "page 3" sees `page` first.

A future release may add an optional structured measure-range field for users who want it (and for coaching that benefits from parsing — e.g., "you've spent 45 minutes on mm. 1–32 across three different spots this month"). The free-text field remains the primary input.

### Active vs. retired spots

Spots have a `retired` state. Retired spots:

- Are hidden from the active session's spot picker by default
- Are hidden from a template's default spot list by default
- Still appear in the piece's history view in the repertoire library
- Still contribute to historical analytics (a retired spot's rating trend is preserved)
- Can be un-retired at any time, restoring them to active without affecting their history

Retiring is a light-touch action accessed from an overflow menu on the spot row, in either the active session or the template editor. There is no confirmation dialog. The label is "Retire from rotation" — explicit and reversible.

Retiring is distinct from **deleting** a spot. Deletion is a separate destructive action behind a confirmation dialog, intended only for spots created by accident. Deletion soft-deletes the spot and unlinks (but does not delete) historical block logs that referenced it — the denormalized spot name is preserved on the historical log.

### Spots and templates

A template's repertoire block references a Piece and carries its own **default spot list** — the spots that are pre-selected when a session is started from this template. The default spot list is a subset of the piece's active spots.

When the user adds a spot mid-session via the active session UI, a small "Add to rotation" toggle appears, defaulted to on. Leaving it on adds the spot to the template block's default spot list as well as the piece's library, so it shows up automatically next time. Toggling it off creates the spot in the piece library but does not add it to this template's defaults — useful for one-off explorations.

### Workflow examples

**Starting a new piece.** Meg creates a new template for violin: "Learn the Bruch concerto." In the template editor, she adds a Repertoire section, then taps "+ Add block" → "Your repertoire" tab. The list is empty. She taps "+ New piece," types "Bruch Violin Concerto in G minor, Op. 26," and creates the piece. The repertoire block is added with no spots. She starts her first session. The repertoire block shows the piece header and an empty spot list. She taps "+ Add spot," dictates "first page," and starts practicing. After 15 minutes she rates it "step forward" and adds a note. Session 2 a few days later: "first page" is pre-selected as the default. She practices it again, then taps "+ Add spot" and adds "development." Both have history from this point on. By session 5 she's added "trouble spots mm. 24–28." All three spots are in the template block's default list and pre-selected at session start. By session 12, the trouble spots are no longer trouble. From the active session, she taps the spot's overflow menu and selects "Retire from rotation." Next session, only "first page" and "development" are pre-selected. The trouble-spots history is preserved in the piece library.

**Pressed-for-time session.** Meg opens the Today tab and starts her violin session. She has 12 minutes. The repertoire block shows three default spots. She taps the piece header instead of any individual spot, marks the whole piece as practiced, rates it "steady," and finishes the session. The log records a BlockLog against the piece with no spot reference. The spots' individual histories are unchanged. Coaching loses some granularity for this session but the consistency streak and overall piece-level history are preserved.

**Repeat last session.** Meg taps "Repeat last session" on the Today tab. The new log is pre-populated with yesterday's exact spot list — three spots from the Bruch repertoire block, one from a Bach block. She decides she doesn't want to do the Bach today, so she unchecks that spot before rating anything. It's removed from the log. She wants to add "cadenza" to the Bruch today (she didn't get to it yesterday). She taps "+ Add spot" on the Bruch block, picks "cadenza" from the recently-practiced list (it was in last week's sessions), and it's added to today's log.

**Self-duplicating a template.** Meg has a "Bruch concerto" template with three repertoire blocks (mvts. I, II, III), each with their own default spots. She wants to make a variant focused on movement I only. She duplicates the template from the template editor. A small confirmation dialog appears: "Copy spots from the original plan? You can always edit them later." with options "Yes, copy spots" (default) and "No, start fresh." She confirms. The new template has the same three repertoire blocks with the same default spot lists. The spots themselves are not duplicated — both templates reference the same Spot entities at the piece level. Practicing in either template contributes to the same spot histories. She edits the new template to remove movements II and III and renames it "Bruch mvt. I deep dive."

---

## 7. Suggestions engine

Rules-based coaching nudges surfaced at contextually appropriate moments rather than collected in a single panel.

**v1 ships three tiers: pre-session, in-the-moment, and post-session.** Pattern-level is post-v1 and is a Pro capability. This section describes the full engine; status tags mark what ships.

### Suggestion tiers

| Tier | Status | Location | Timing | Examples |
|------|--------|----------|--------|----------|
| Post-session reflection | **[v1]** | Session summary, coaching card | After finishing | "You've practiced 4 of the last 7 days — one more this week hits your goal." / "Your Bruch first page is trending forward for the second session in a row." |
| Pre-session nudges | **[v1]** | Today tab, above start button | Before practicing | "Your scales coverage has dropped off — consider adding a scales block today." / "It's been 5 days — even a short session counts." |
| In-the-moment coaching | **[v1]** | Active session, inline below exercises | During practice | "Last session you noted intonation was shaky in the top octave." / "Try bumping tempo to 80 this time." |
| Pattern-level insights | **[post-v1 — Pro]** | Progress tab | When reviewing stats | "Your average session is 15 min shorter on weekends." / "You tend to skip cool-down sections — these help with retention." |

**Implementation status.** Pre-session is shipped and rendering on the Today tab. **In-the-moment is half-built and is the one open build item in this section:** the API client (`getInSessionSuggestions`), the `hint` Card variant, and a `/preview` mock all exist, but nothing renders them in the live session. Completing it means rendering `HintCard` beneath the relevant `ExerciseRow`, keyed by `block_log_id` from the existing endpoint response — plus implementing the two backing rules if they are not yet live server-side. This work is tracked in **#315** (created 2026-08-19, after the audit).

**On pattern-level.** Firmly out of v1, and a **Pro capability** when it ships. It must not appear in v1 in any form, including a stub or an empty state. Shipping it in v1 would make it permanently free and remove a Pro column entry.

Spot-level suggestions are a class of in-the-moment and post-session coaching enabled by the repertoire model. Examples: "Your Bruch first-page spot has been step-forward three sessions in a row — try the next page" / "The trouble-spots passage hasn't improved in two weeks — try slower and shorter" / "You retired 'trouble spots mm. 24–28' six weeks ago — want to spot-check it?" Their status follows their tier and the repertoire decision (§12).

### Rules

Nine rules are defined in `kantelo-schema-api.md` §5. v1 implements the post-session tier only:

| Rule | Tier | Status |
|------|------|--------|
| `weekly_consistency` | post_session | **[v1]** |
| `spot_plateau` | post_session | **[v1]** |
| `consistency_nudge` | pre_session | **[v1]** |
| `section_coverage_drop` | pre_session | **[v1]** |
| `previous_block_note` | in_the_moment | **[v1]** |
| `tempo_progression` | in_the_moment | **[v1]** |
| `spot_step_forward_streak` | in_the_moment | **[v1]** |
| `retired_spot_check` | pattern_level | **[post-v1 — Pro]** |
| `whole_piece_overuse` | pattern_level | **[post-v1 — Pro]** |

Seven of the nine rules ship in v1. `previous_block_note` is worth singling out: surfacing the user's own note from the last time they played this exact passage is the closest the product comes to "a coach in the room," and it is the strongest argument for finishing the in-the-moment tier.

### Design principles for suggestions

- Max one pre-session suggestion per visit to the Today tab.
- In-the-moment suggestions should be subtle — small expandable hint cards, not banners.
- Post-session suggestions should combine backward-looking reflection with forward-looking motivation.
- Suggestions should never appear as badge counts or notification dots (creates anxiety).
- Suggestions should never appear on the Plans tab (building/editing context) or Profile tab (admin context).

### User controls **[v1]**

- Global opt-out in Settings.
- Three-option radio: All / Fewer / Off. All three are behaviorally distinct in v1 — see §5.8.
- "Fewer suggestions" limits suggestions to the session summary screen. (It will also cover the Insights sub-tab once pattern-level ships.)
- Individual suggestions are dismissible (tracked server-side so dismissed suggestions don't reappear).

---

## 8. Freeform sessions

Users can practice without following a template. Accessed via "Practice off-plan" link on the Today tab.

Opens the same active session screen but empty. The user adds sections and blocks as they go using "+ Add a section" and the block library. Specifies duration per section via the time stepper.

Freeform sessions save into the same session history and feed the same analytics as template-based sessions. The suggestions engine can observe freeform patterns and nudge toward creating a template: "You've logged 5 freeform sessions this month. Want to turn your usual routine into a plan?"

Repertoire is available in freeform sessions too. The "+ Add a section" flow lets the user add a repertoire block by picking a piece from the instrument's library (or creating a new piece on the fly), then selecting or adding spots inline. Freeform repertoire logs feed the same piece/spot history as template-based logs.

---

## 9. Data model considerations

Key entities and their relationships (for developer reference, not a full schema):

- **User** — has many Instruments, has Settings
- **Instrument** — belongs to User, has many Templates, has many Pieces, has practice frequency setting
- **Piece** — belongs to Instrument, has name, optional composer/source, has many Spots. Created lazily.
- **Spot** — belongs to Piece, has name, optional location (free text), active/retired state. Has many BlockLogs (via reference).
- **Template** — belongs to Instrument, has many TemplateSessions, has name, description, active/archived status. **At most one template per instrument can be active at a time in v1.** Activating a new template auto-archives the previous one. Archived templates remain in the Plans tab and can be reactivated.

  **[post-v1] Multiple active plans per instrument** is a planned relaxation of this invariant (ticket #225), deferred out of v1 because it reshapes the Today tab rather than just the schema. The single plan card exists so that Today answers "what should I practice right now" without making the user choose — the decision fatigue the product is built to eliminate. Supporting N active plans requires deciding what Today shows instead (multiple cards? a picker? a rule for choosing?), and how "Repeat last session" behaves when rotation position is ambiguous across plans. Design work first, then the schema change: drop `uq_one_active_template_per_instrument`, drop the auto-deactivate logic in `PATCH /api/templates/{id}`, and change `GET /api/today` to return a list rather than a single `current_session`.
- **TemplateSession** — belongs to Template, has name (user-provided), focus description, order in rotation, has many Sections
- **Section** — belongs to TemplateSession, has type (warm-up, scales, repertoire, etc.), has many Blocks, has estimated duration
- **Block** — belongs to Section. Two flavors: a **standard block** (name, description, tempo, key, etc., optionally referencing a CuratedBlock) or a **repertoire block** (references a Piece, carries a default spot list via a join table). Repertoire blocks do not have their own name/tempo/key — those come from the piece and spots.
- **TemplateBlockSpot** — join table linking a repertoire Block to its default Spots, with display order. Allows the same spot to be in multiple templates' default lists.
- **PracticeLog** — belongs to Instrument, optionally linked to a Template and TemplateSession. Has date, total duration, notes, reflection_prompt (which rotating question was shown), reflection_response (user's answer, nullable). Has many SectionLogs.
- **SectionLog** — belongs to PracticeLog, captures section-level duration and completion.
- **BlockLog** — belongs to SectionLog. For standard blocks: has rating, notes, completed. For repertoire blocks: also references a Spot (nullable — null means "logged against the whole piece without a spot"). Each spot practiced in a session gets its own BlockLog row.
- **CuratedBlock** — instrument-specific library entry. Has name, description, category, usage count (for popularity ranking).
- **Suggestion** — engine-generated, linked to User/Instrument. Has type, content, dismissed status.

---

## 10. Future scope

These features are part of the product vision but not in scope for the initial build:

- **Teacher-student integration:** Teacher can assign/customize templates, view student session logs, leave contextual feedback on sessions or exercises. Not scheduling or general messaging.
- **Shared templates with suggested spots.** When teachers share templates with students (or when any template-sharing flow is built), the shared template carries its repertoire block references but spots come through as **suggested spots**, not as the recipient's live spots. The recipient can accept any suggested spot into their own piece library with one tap (which also adds it to the template's default list) or ignore it. Accepted spots become normal spots from then on, with history tied to the recipient. This preserves the invariant that every spot in a user's history is one they actually practiced. The data model should be forward-compatible: a future `suggested_spots` table can reference pieces without changing the main `spots` table.
- **Structured location parsing.** An optional structured measure-range field on spots, alongside the free-text location, enabling coaching like "you've spent 45 minutes on mm. 1–32 across three different spots this month."
- **Repertoire catalog.** A shared catalog of standard repertoire (IMSLP-style) that users can pick from instead of typing piece names, with autocomplete and canonical metadata. Free-text piece names remain the primary input; the catalog is an optional accelerator.
- **Peer-to-peer social features:** Shared streaks, practice leaderboards among friends, practice groups for ensembles.
- **AI-generated plans:** The quick-start wizard currently generates plans from simple rules. Future versions could use AI to generate more sophisticated, personalized plans based on the user's goals, history, and instrument.
- **Audio recording:** Record practice sessions or excerpts for self-review or teacher feedback.
- **Metronome / tuner integration:** Built-in practice tools within the active session.

---

## 11. Wireframes

Wireframes were developed in conversation and should be saved as screenshots in `/docs/wireframes/`. The following wireframes exist:

| File | Description |
|------|-------------|
| `today-tab.png` | Today tab with instrument toggle, suggestion, plan card, start button |
| `active-session.png` | Active session with progress bar, inline logging, directional ratings (step back/steady/step forward), per-exercise notes, time steppers |
| `session-summary.png` | Post-practice summary with stats, exercise list with directional ratings and notes, coaching suggestion, guided reflection prompt |
| `quickstart-step1.png` | Wizard step 1: instrument selection |
| `quickstart-step2.png` | Wizard step 2: what are you working on |
| `quickstart-step3.png` | Wizard step 3: session area selection |
| `quickstart-step4.png` | Wizard step 4: time budget and plan preview |
| `template-editor.png` | Template editor with session tabs, section cards, block list |
| `block-library.png` | Add block screen with curated library and custom creation |
| `rating-chevrons.png` | Rating indicator design: directional chevrons (step back/steady/step forward) with amber/gray/teal color |
| `progress-history.png` | Progress tab, History sub-tab: pattern suggestion card, time filters, session list with expanded/collapsed states |
| `progress-insights.png` | Progress tab, Insights sub-tab: pattern suggestion card, practice calendar heatmap, weekly time comparisons with bar chart, rating trend stacked bars |
| `profile.png` | Profile tab: account header, instrument cards with inline frequency settings, coaching suggestions radio options, preferences |

**TODO — wireframes to create for the repertoire model and updated wizard.** The following wireframes are planned but not yet created. They should be designed before or alongside the frontend implementation of the repertoire model.

| File | Description |
|------|-------------|
| `repertoire-library.png` | Per-instrument repertoire library: pieces list, expandable to show active and retired spots, with management affordances |
| `active-session-repertoire.png` | Active session showing a repertoire block with piece header, spot rows with checkboxes/locations/ratings, and "+ Add spot" inline |
| `template-editor-repertoire.png` | Template editor with a repertoire block, showing default spot list management |
| `block-library-repertoire-tab.png` | Block library "Your repertoire" tab, pieces expandable to spots |
| `quickstart-step4-repertoire.png` | New wizard step 4: optional "anything you're working on" question |
| `quickstart-step5.png` | Renumbered wizard step 5 (was step 4): time budget and plan preview |

### Wireframe conventions

- Wireframes are mobile-first (375px width) but the app is a responsive web app, not a native mobile app.
- Colors in wireframes are placeholder — final visual design and brand identity are not yet determined.
- Wireframes show structure and interaction patterns, not final copy or content.

---

## 12. v1 scope boundary

**This section is authoritative.** Where it disagrees with a body section, this section wins. See §0 for tag definitions and the pricing invariant.

**Ticket audit instructions.** Every open ticket should map to exactly one row below. A ticket implementing a **[v1]** or **[v1 — launch prerequisite]** row is in scope. A ticket implementing an **[undecided]** row must be labeled blocked pending the scope decision, not silently built. A ticket implementing a **[post-v1]** or **[post-v1 — Pro]** row is out of scope and should be relabeled, not closed — those tickets are the roadmap. Any **[v1]** row with no covering ticket is a gap.

**Revision note (August 2026).** This table was reconciled against the 2026-08-18 scope audit of shipped code and open tickets. Most rows previously marked `[undecided]` were found already built and have been promoted to `[v1]`. Two of my earlier taggings were wrong and have been corrected — per-spot history (§12.5) and the coaching preference control (§5.8).

### 12.1 Today tab

| Feature | Status | Notes |
|---|---|---|
| Instrument pill toggle | **[v1]** | |
| Plan card, rotation indicator, section pills | **[v1]** | |
| "Start session" | **[v1]** | |
| "Practice off-plan" | **[v1]** | |
| No-plan state → quick-start wizard | **[v1]** | |
| Pre-session suggestion card | **[v1]** | Shipped |
| "Repeat last session" shortcut | **[v1]** | Shipped |

### 12.2 Active session

| Feature | Status | Notes |
|---|---|---|
| Section cards, time steppers, checkboxes | **[v1]** | |
| Rating chevrons (step back / steady / step forward) | **[v1]** | |
| Per-exercise notes | **[v1]** | |
| Section-level actions (mark all done, skip section) | **[v1]** | |
| Quick-add block | **[v1]** | |
| "+ Add a section" mid-session | **[v1]** | |
| Session notes | **[v1]** | |
| Repertoire blocks (piece header, spot rows, whole-piece logging, inline spot add) | **[v1]** | Shipped |
| Voice input (mic on all text fields) | **[v1]** | Shipped — but see the platform warning in §5.2 |
| Smart tempo defaults | **[v1]** | Shipped |
| Session auto-save / resume | **[v1]** | Shipped. May become load-bearing — see §12.7 |
| In-the-moment suggestion hint cards | **[v1]** | **Half-built; ticketed as #315.** See §7 |

### 12.3 Session summary

| Feature | Status | Notes |
|---|---|---|
| Stat cards (minutes, exercises, streak) | **[v1]** | |
| "What you practiced" list with ratings and notes | **[v1]** | |
| Post-session coaching card | **[v1]** | Never gated. The reward moment of every session. |
| Guided reflection prompt (11-prompt rotation) | **[v1]** | |
| "Edit this session" | **[v1]** | |

### 12.4 Plans tab

| Feature | Status | Notes |
|---|---|---|
| Template list | **[v1]** | |
| Template editor (sessions, sections, blocks) | **[v1]** | |
| Section-type picker | **[v1]** | **Gap** — currently hardcoded `custom` (#168) |
| Drag-and-drop reordering | **[v1]** | **Gap** (#46) |
| Block library — curated, recently used, custom creation | **[v1]** | |
| Block library "Your repertoire" tab | **[v1]** | Shipped |
| Template duplication | **[v1]** | Shipped |
| Multiple active plans per instrument | **[post-v1]** | #225. Reshapes Today — see §9 |

### 12.5 Progress tab

| Feature | Status | Notes |
|---|---|---|
| History sub-tab, expandable session cards | **[v1]** | Unlimited and permanent. Never capped. |
| Time filter pills (all / week / month) | **[v1]** | |
| Insights — rating trend, **4 weeks** | **[v1]** | **Pricing-critical. Not droppable.** |
| Insights — practice heatmap, full year | **[v1]** | Browsing a past year is free |
| Insights — this week vs. last, with paired bar chart | **[v1]** | |
| **Per-spot history** (log list: dates, ratings, notes) | **[v1]** | **Corrected.** This is history, and history is free — §0 and the pricing doc §2.7. Shipped as `SpotHistorySheet.tsx`. |
| Per-spot **rating trend** (aggregation, trend chart) | **[post-v1 — Pro]** | The analysis layer on top of history — the same free/paid line as the top-level trend. `SpotHistorySheet` currently renders `rating_trend`; **#317** removes it so v1 shows the log list only. |
| Rating trend beyond 4 weeks (months, quarters) | **[post-v1 — Pro]** | Do not expose a window control in v1 |
| Per-piece rating trends | **[post-v1 — Pro]** | |
| Heatmap year-over-year comparison (overlay, deltas) | **[post-v1 — Pro]** | Endpoint already takes `year`; exclude deliberately |
| Pattern-level suggestion cards | **[post-v1 — Pro]** | #253. Not even as a stub |
| Section-type distribution, per-exercise drill-down, progress timelines | **[post-v1]** | |

### 12.6 Profile tab, wizard, cross-cutting

| Feature | Status | Notes |
|---|---|---|
| Account header, Clerk "Manage account" | **[v1]** | |
| Instruments list with inline frequency pills | **[v1]** | |
| Add instrument | **[v1]** | |
| Coaching suggestions — **three-option radio** | **[v1]** | **Corrected** — All/Fewer/Off are distinct now that pre-session and in-the-moment ship. §5.8 |
| Preferences (default duration, week starts on) | **[v1]** | |
| Sign out | **[v1]** | |
| Repertoire library (per-instrument piece/spot management) | **[v1]** | Shipped. Body text in §5.8 and the repertoire doc still calls this "not yet designed" — stale. |
| Quick-start wizard, all five steps | **[v1]** | Including step 4 → creates a Piece |
| Light and dark mode | **[v1]** | Both first-class |
| Desktop layout design pass | **[v1]** | **#316.** Without the secondary panel, desktop is a 520px column with a side nav and an empty right third. Needs a layout treatment that reads as deliberate rather than unfinished. See note below. |
| Desktop secondary panel | **[post-v1]** | #218. Desktop is fully usable without it — by its own spec it duplicates content available elsewhere. |
| Billing, payments, subscriptions, entitlement checks | **not in v1** | #39. No paywall code of any kind |

### 12.7 Launch prerequisites

Must be live on launch day. Not user-facing product features, which is why they have no screen spec — and why the 2026-08-18 audit missed them: it treated §12 as the complete definition of v1 when §12 only covered features.

| Item | Status | Notes |
|---|---|---|
| Error tracking (Sentry or equivalent) | **[v1 — launch prerequisite]** | **#306** (carved from #89; the epic stays post-v1). Know it broke before a beta user reports it. |
| Uptime monitoring | **[v1 — launch prerequisite]** | **#307.** Free tier of anything |
| **Product analytics** | **[v1 — launch prerequisite]** | **#308. Hard requirement — see below** |
| Mobile packaging (Capacitor) | **[v1 — launch prerequisite]** | #54. Pending the viability spike — `kantelo-capacitor-spike.md` |
| In-app account deletion | **[v1 — launch prerequisite]** | **#312.** Apple requires it for any app with account creation; it also satisfies the data-deletion obligation. One surface, two obligations. |
| Node runtime pinned (22 LTS across `.nvmrc`, CI, Dockerfile) | **[v1 — launch prerequisite]** | #260. Node 20 is EOL |
| Pre-prod schema hygiene | **[v1 — launch prerequisite]** | #270. Non-integer PKs, table naming. **Now-or-never** — trivial before real user data, painful after. Sequence with any other pre-prod migration. |
| Empty states that teach | **[v1 — launch prerequisite]** | **#310** (umbrella); #287 is the Insights instance. The one in-app onboarding piece. |
| Concept education ("how Kantelo works") | **[v1 — launch prerequisite]** | **#309.** Lives on kantelo.app, not in-app — GTM thread #3. Covers directional ratings, spots, what the trend means. |
| Operational user lookup | **[v1 — launch prerequisite]** | **#311.** Direct DB queries at beta scale (no UI). #40 (full admin site) stays post-v1. |
| Full observability stack | **[post-v1]** | #89 |
| Admin site | **[post-v1]** | #40 |
| In-app tutorials / video onboarding | **[post-v1]** | #26, #27 |

#### Why analytics is a hard requirement

The beta pricing posture (`kantelo-gtm-positioning-pricing.md` §2.3) ends the free beta on a **retention trigger**: N users who have logged sessions in three consecutive weeks. That is a cohort measurement, and **it cannot be computed retroactively over a period that was not instrumented.** Analytics must be live from day one of the beta or the pricing trigger has no data to fire on.

Minimum event set, derived backward from the questions that need answering:

| Event | Answers |
|---|---|
| `user_signed_up` | Cohort entry point |
| `wizard_step_completed` / `wizard_abandoned` | Where new users fall out |
| `session_started` (instrument, template vs. freeform) | Activation |
| `session_finished` (duration, blocks rated) | **The retention event — the beta trigger runs on this** |
| `insights_viewed` | Whether the differentiator is actually seen |

Five events. Resist adding more: a bloated event set is harder to reason about and expands the privacy policy surface (GTM thread #4).

#### Desktop layout without the secondary panel

Cutting #218 leaves the three-column structure in `kantelo-design-tokens.md` §11 with an empty third column. The fix is a layout decision, not a feature:

- **Centering** — with the panel gone, is the main column centered in the remaining space, or does it stay left-anchored beside the nav? Centering generally reads better; it also means the content shifts position if the panel ever returns.
- **Max-width** — 520px is correct for line length and should not grow. The question is what surrounds it.
- **Background treatment** — the warm stone `page-bg` across a wide empty area is the main thing that can read as unfinished.
- **Reversibility** — whatever is chosen should not make re-adding the panel post-v1 a rewrite.

Not a large piece of work, but it should be decided deliberately rather than defaulted into, since desktop is the first impression for anyone opening a link on a laptop.

### 12.8 Remaining open decisions

1. **In-the-moment coaching** — recorded here as `[v1]` per current direction and ticketed as **#315**. Settled 2026-08-19 (finish it); noted here as the one feature that had been a lean rather than an original settled decision.

Everything else previously listed here is resolved.

### 12.9 Known stale text elsewhere in the docs

Flagged rather than fixed, since these live in other files:

- `kantelo-frontend-repertoire.md` describes the Profile repertoire library as "not yet designed." It is shipped.
- `kantelo-frontend-plan.md` lists voice input, smart tempo defaults, repeat-last-session, template duplication, and session auto-save as flat Phase 1/4 requirements with no status. Now consistent with `[v1]`, but the plan has no scope tags and should be reconciled against this table.
- `kantelo-design-tokens.md` §6 (Voice input) specifies a feature-detection fallback that does not work in WKWebView. See §5.2.
- `kantelo-design-tokens.md` §11 describes the desktop layout as three-column with the secondary panel. With #218 deferred, that section needs updating to describe the two-column v1 layout and the treatment of the remaining space.
