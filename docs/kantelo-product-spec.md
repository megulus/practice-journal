# Kantelo — Product Specification

> A practice coach for musicians. Practice smarter. Not just more.

This document captures the product decisions, information architecture, user flows, and UX design for Kantelo. It is intended as a reference for developers (human or AI) building or iterating on the application.

**Last updated:** March 2026
**Domain:** kantelo.app
**Origin:** The name comes from the Finnish *kantele*, the mythic stringed instrument from the Kalevala epic. When Väinämöinen played the kantele, every creature in nature fell silent to listen. That's what great practice leads to.

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
    ├── Settings (including suggestions opt-out)
    └── Account
```

### Key structural decisions

- **Instrument management moves to Profile.** It is part of setup/settings, not the daily workflow. For multi-instrument users, a lightweight pill toggle on the Today tab switches context.
- **Plan viewing and practice logging are merged** into a single "active session" flow. There is no separate "log practice" screen.
- **Freeform logging** is accessed via a "Practice off-plan" link on the Today tab, which opens the same active session screen but empty — the user adds sections as they go.
- **The plan-less user** (no templates yet) sees the Today tab adapted as a quick-start wizard.

---

## 5. Screen specifications

### 5.1 Today tab

The default landing screen. Answers: "What should I practice right now?"

**Layout (user with active plan):**

1. **Instrument toggle** (top) — pill-style selector showing all instruments. Tapping switches the view. Only visible for multi-instrument users.
2. **Pre-session suggestion** (optional) — a warm, contextual coaching nudge. Max one per session. Example: "Your scales coverage has dropped off — consider adding a scales block today." Styled as a subtle card with an amber accent, dismissible. See section 7 for suggestion tier details.
3. **"Today's practice" header** with rotation progress indicator (filled dots showing position in the rotation cycle).
4. **Plan card** containing:
   - **Day focus** (large, primary text) — the user-written description of this session's focus. Example: "Slow practice on movement II". This is the headline.
   - **Plan source** (smaller, secondary text) — the plan name, session number, and estimated duration. Example: "Learn the Bruch concerto — session 3 of 7 · ~25 min"
   - **Section pills** — compact tags showing what the session includes (Warm-up, Scales, Repertoire, Cool-down).
5. **"Start session" button** — primary action, full-width, prominent.
6. **"Practice off-plan" link** — secondary, below the button. Opens an empty active session for freeform logging.

**Layout (user with no plan — first-run / quick-start wizard):**

See section 5.5 (Quick-start wizard).

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
- **Exercise rows** within the section, each containing:
  - Checkbox (tap to mark done)
  - Exercise name and metadata (tempo, key, etc.)
  - Rating indicator (see below)

**Completed sections** fade back (reduced opacity) so visual focus falls on what's next. They show logged time vs. plan time as a quiet reference (e.g., "3 min (plan: 2)").

**Rating indicator (chevrons):**

Three circular buttons per exercise, each containing a directional arrow. The rating measures **trajectory, not quality** — "how did this compare to last time?" rather than "how good was that?" This framing is deliberate: musicians are notoriously self-critical, and asking them to declare victory ("Nailed it") skews data negative and makes logging feel punishing. Asking about direction is an observation, not a boast.

- **Down chevron** = Step back (amber background when selected: #FAEEDA fill, #BA7517 stroke) — harder than last time, or something regressed
- **Horizontal line** = Steady (gray background when selected) — about the same as last time
- **Up chevron** = Step forward (teal background when selected: #E1F5EE fill, #0F6E56 stroke) — improvement, even small

Directional shape encodes meaning independently of color (accessible to colorblind users). A text label ("Step back", "Steady", "Step forward") appears on selection for the first few uses. The framing is consistent from the first session onward — even without a prior session to compare against, users can interpret the scale against their own internal baseline.

**Per-exercise notes:**

Each exercise row includes a small "add note" link that expands an inline text field below the exercise. Notes are scoped to a specific block (stored in BlockLog), not the whole session. This is where users write observations like "intonation still shaky in the top octave of mm. 24–28." The suggestions engine can surface these back in future sessions ("Last session you noted..."). The note field is optional and collapsed by default — zero friction for users who just want to tap ratings and move on.

**In-the-moment suggestions:**

Small, expandable hint cards that appear inline below specific exercises. Drawn from the user's own history. Example: "Last session you noted intonation was shaky in the top octave." Styled as a subtle card in the secondary background color.

**Bottom of screen:**
- Notes textarea: "Notes — breakthroughs, challenges, ideas..."
- "Finish session" button (primary)
- "+ Add a section" link (freeform escape hatch — add unplanned work mid-session)

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

Per-exercise notes from the active session are displayed inline below the relevant exercise, providing context for the rating.

**Post-session suggestion:**

A coaching insight card (teal background) that combines backward-looking reflection and forward-looking motivation. The card should use the directional rating language. Example: "You've practiced 4 of the last 7 days — one more this week matches your goal. Your mm. 1–16 are trending forward for the second session in a row. For mm. 17–32, try an even slower tempo next time — sometimes a step back means you're ready to go deeper."

**Guided reflection prompt:**

Below the coaching card, a rotating question with a single optional text field. The prompt encourages noticing over evaluating — it should work equally well whether the session went great or rough. The answer is stored on the PracticeLog alongside session-level notes.

Prompt rotation pool (11 prompts):

- *Progress-oriented:* "What felt different today?" / "What was easier than you expected?" / "Did anything click that hadn't before?"
- *Forward-looking:* "What do you want to focus on next time?" / "If you had 10 more minutes, what would you spend them on?"
- *Awareness-building:* "What did you notice about your playing today?" / "Where did your attention go during the session?" / "Was there a moment you want to remember?"
- *Honest check-in:* "What was the hardest part of today's session?" / "Did anything surprise you?" / "How does your body feel after playing?"

Styled with a brief subtext: "Optional — a moment to notice what you might forget later." Placeholder text models a good answer (e.g., "Felt more relaxed in the left hand. Maybe the new warm-up is helping...").

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

### 5.5 Block library

Opens when user taps "+ Add block" within a section. Context-aware — the header shows which section the block is being added to.

**Search box** at the top doubles as the custom block creator. Typing filters the curated library; if no match, the custom input field at the bottom pre-fills.

**Curated library:** Organized by category, filtered and sorted by relevance to the current section and instrument. Each library item shows:
- Block name
- Brief description
- Popularity indicator (percentage of users with this instrument who include this block) — crowd-sourced social proof

**Categories shown:**
- "Popular for [instrument] [section type]" — the most relevant blocks
- "Technique and etudes" — standard exercise literature
- "Other" — improvisation, sight-reading, ear training, etc.

**Custom block creation:** Text input at the bottom with an "Add" button. Always available as a fallback. Users can type any block name.

**Hybrid model:** For v1, the app provides a curated starter set of common block types per instrument. Users can create custom blocks freely. Over time, popular custom blocks can be promoted into the curated set.

### 5.6 Quick-start wizard

Shown on the Today tab for users with no active plan. Four steps, each a single screen. Goal: zero to practicing in under a minute.

**Step 1 — Instrument:**
"What do you play?" with a grid of common instrument pills (Violin, Viola, Cello, Piano, Guitar, Flute, Voice, Other...). Single selection. "Skip setup" link in top bar for users who want to go straight to freeform.

**Step 2 — Goal:**
"What are you working on right now?" with a free-text input field. Placeholder: "e.g. Bruch Violin Concerto, sight-reading..." This becomes the plan name. "I'm not sure yet — just get me started" link skips this step and generates a generic plan.

**Step 3 — Session areas:**
"What should a session include?" with checkbox rows for practice areas: Warm-up, Scales and technique, Repertoire, Sight-reading, Ear training, Cool-down. Warm-up, Scales, Repertoire, and Cool-down are pre-selected as defaults.

**Step 4 — Time and preview:**
"How much time today?" with four time-budget buttons (15, 30, 45, 60 min). The app generates a balanced plan preview based on selected areas and time budget. Preview shows each section with name, brief description, and time allocation. "Customize this plan" link opens the template editor. "Start practicing" button drops into the active session. "Save plan and practice later" saves without starting.

The bottom nav appears on step 4 (user is now "in" the app). Steps 1–3 do not show the nav.

### 5.7 Progress tab

The Progress tab uses two sub-tabs: **History** (default) and **Insights**. Both sub-tabs share the instrument pill toggle at the top (same behavior as the Today tab — switches all content to the selected instrument).

**Pattern-level suggestion cards** appear at the top of both sub-tabs, styled with an info-blue accent to distinguish them from the amber pre-session suggestions on the Today tab. The suggestion content can differ between sub-tabs: History might surface session-specific patterns ("You tend to skip cool-down sections"), while Insights might surface frequency patterns ("Your average session is 15 min shorter on weekends"). Suggestions are dismissible and follow the same server-side tracking as other suggestion tiers.

#### History sub-tab (default)

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
- Block list with colored dots matching the rating scheme (teal = step forward, gray = steady, amber = step back, light gray = skipped) and rating label in words
- Per-exercise notes displayed inline below the relevant exercise (if any were logged)
- Session-level notes (if any)
- Reflection prompt response (if any)

**Filtering:** A row of time-range pills (All sessions / This week / This month) sits below the suggestion card. Instrument filtering is handled by the pill toggle at the top. Session type filtering (template vs. freeform) and date range filtering can be added in a later release.

#### Insights sub-tab

Four components, each answering a distinct question about the user's practice:

**1. Practice calendar heatmap**

A GitHub-style contribution grid showing practice activity over the year. Rows are days of the week (Mon–Sun), columns are months. Cell intensity maps to practice duration (not just binary practiced/didn't-practice), using the teal ramp: empty (no practice), light, medium, dark, full. A legend ("Less → More") sits below the grid.

This is the primary consistency motivator — the user can see the pattern of their week/month at a glance. It answers: "Am I showing up?"

**2. Time comparisons ("This week vs. last")**

Two side-by-side stat cards showing:
- Days practiced (with delta, e.g., "+1 day vs. last week")
- Total practice time

Below the stat cards, a paired bar chart shows daily breakdown for the current and previous week (teal bars = this week, gray bars = last week). This makes weekly patterns visible at a glance.

Answers: "Am I practicing consistently?"

**3. Rating trend ("How it's going")**

Stacked horizontal bars showing the step back / steady / step forward distribution for each of the last 4 weeks. Uses the same amber / gray / teal color scheme as the rating chevrons. A plain-language summary sits below the chart (e.g., "Trending up — more exercises moving forward each week").

This is the key differentiator from other practice trackers — it directly answers: "Am I getting better?" No other app in the competitive landscape visualizes improvement trajectory this way.

**4. Pattern-level suggestion card** (described above, shared with History sub-tab)

**Deferred to a later release:** Section-type distribution (where time goes), per-exercise drill-down views, and exercise-level progress timelines. These are valuable but not emotionally compelling enough for v1 — they're "hmm, neat" rather than "yes, I'm getting better."

### 5.8 Profile tab

A single scrollable page (no sub-tabs — not enough content to justify them) with four sections:

**Account header:**

Compact row showing avatar (initials circle), display name, email, and a "Manage account" link that opens Clerk's account management UI. Clerk handles authentication, password changes, and profile editing.

**My instruments:**

Each instrument is a card showing:
- Instrument name with an "edit" link (opens detail view for removing the instrument, viewing its plans, etc.)
- Practice frequency setting as inline pills: Daily / Few times a week / Weekly / Occasionally. Adjustable directly on the card — no drill-down needed. This setting calibrates the suggestions engine and Today tab instrument rotation (see section 6).
- Summary line: number of active plans and last practice date (e.g., "1 active plan · last practiced today")

"+ Add instrument" button below the instrument cards (dashed border style, matching the template editor's "+ Add section" pattern).

**Coaching suggestions:**

Three radio button options with descriptions:
- **All suggestions** — "Before, during, and after practice." Pre-session nudges, in-the-moment coaching, post-session reflection, and pattern-level insights are all active.
- **Fewer suggestions** — "Only in session summaries and Insights." Disables pre-session nudges and in-the-moment coaching. Post-session coaching cards and Progress tab pattern insights remain.
- **Off** — "No coaching suggestions anywhere." All suggestion tiers disabled.

**Preferences:**

Slim for v1:
- **Default session duration** — used by the quick-start wizard when generating a plan. Options: 15, 30, 45, 60 min.
- **Week starts on** — affects the practice calendar heatmap and weekly comparisons in Insights. Options: Monday / Sunday.

Additional preferences can slot in here as needed in later releases.

**Sign out** button at the bottom (danger-colored text, no fill).

---

## 6. Multi-instrument model

Multi-instrument users see a pill toggle at the top of the Today tab. Each instrument has its own templates, session history, and analytics.

### Practice frequency setting

Each instrument has a configurable expected cadence (daily, a few times a week, weekly, occasionally). This setting controls:

- **Today tab:** Only instruments that are "due" based on their cadence and last practice date are surfaced. A horn practiced weekly doesn't show up every day.
- **Suggestions engine:** Consistency nudges respect the expected cadence. "It's been 3 days since you last practiced piano" only fires if piano is set to daily or a-few-times-a-week, not weekly.
- **Rotation across instruments:** For alternating instruments (e.g., violin and viola on alternate days), the Today tab can show both when they're due on the same day.

---

## 7. Suggestions engine

Five rules analyze practice patterns and surface coaching nudges. Suggestions are distributed across the app at contextually appropriate moments rather than collected in a single panel.

### Suggestion tiers

| Tier | Location | Timing | Examples |
|------|----------|--------|----------|
| Pre-session nudges | Today tab, above start button | Before practicing | "Your scales coverage has dropped off — consider adding a scales block today." / "It's been 5 days — even a short session counts." |
| In-the-moment coaching | Active session, inline below exercises | During practice | "Last session you noted intonation was shaky in the top octave." / "Try bumping tempo to 80 this time." |
| Post-session reflection | Session summary, coaching card | After finishing | "You've practiced 4 of the last 7 days — one more this week hits your goal." / "Your mm. 1–16 are trending forward for the second session in a row. For mm. 17–32, sometimes a step back means you're ready to go deeper." |
| Pattern-level insights | Progress tab | When reviewing stats | "Your average session is 15 min shorter on weekends." / "You tend to skip cool-down sections — these help with retention." |

### Design principles for suggestions

- Max one pre-session suggestion per visit to the Today tab.
- In-the-moment suggestions should be subtle — small expandable hint cards, not banners.
- Post-session suggestions should combine backward-looking reflection with forward-looking motivation.
- Suggestions should never appear as badge counts or notification dots (creates anxiety).
- Suggestions should never appear on the Plans tab (building/editing context) or Profile tab (admin context).

### User controls

- Global opt-out in Settings.
- "Fewer suggestions" option limits suggestions to the session summary screen and the Insights sub-tab only.
- Individual suggestions are dismissible (tracked server-side so dismissed suggestions don't reappear).

---

## 8. Freeform sessions

Users can practice without following a template. Accessed via "Practice off-plan" link on the Today tab.

Opens the same active session screen but empty. The user adds sections and blocks as they go using "+ Add a section" and the block library. Specifies duration per section via the time stepper.

Freeform sessions save into the same session history and feed the same analytics as template-based sessions. The suggestions engine can observe freeform patterns and nudge toward creating a template: "You've logged 5 freeform sessions this month. Want to turn your usual routine into a plan?"

---

## 9. Data model considerations

Key entities and their relationships (for developer reference, not a full schema):

- **User** — has many Instruments, has Settings
- **Instrument** — belongs to User, has many Templates, has practice frequency setting
- **Template** — belongs to Instrument, has many Sessions (rotation units), has name, description, active/archived status. **At most one template per instrument can be active at a time.** Activating a template auto-archives the previous one. Archived templates remain in the Plans tab and can be reactivated.
- **Session (template unit)** — belongs to Template, has name (user-provided), focus description, order in rotation, has many Sections
- **Section** — belongs to Session, has type (warm-up, scales, repertoire, etc.), has many Blocks, has estimated duration
- **Block** — belongs to Section, has name, description, estimated duration, metadata (tempo, key, difficulty), order in section. May reference a curated block from the library.
- **PracticeLog** — belongs to Instrument, optionally linked to a Template and Session. Has date, total duration, notes, reflection_prompt (which rotating question was shown), reflection_response (user's answer, nullable). Has many BlockLogs.
- **BlockLog** — belongs to PracticeLog, linked to a Block (or freeform). Has actual duration, rating (-1=step back, 0=steady, 1=step forward), notes (per-exercise note, nullable).
- **Suggestion** — engine-generated, linked to User/Instrument. Has type, content, dismissed status.
- **CuratedBlock** — instrument-specific library entry. Has name, description, category, usage count (for popularity ranking).

---

## 10. Future scope

These features are part of the product vision but not in scope for the initial build:

- **Teacher-student integration:** Teacher can assign/customize templates, view student session logs, leave contextual feedback on sessions or exercises. Not scheduling or general messaging.
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

### Wireframe conventions

- Wireframes are mobile-first (375px width) but the app is a responsive web app, not a native mobile app.
- Colors in wireframes are placeholder — final visual design and brand identity are not yet determined.
- Wireframes show structure and interaction patterns, not final copy or content.
