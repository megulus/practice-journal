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
│   ├── Session history
│   ├── Analytics dashboard
│   └── Exercise progress
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

Three circular buttons per exercise, each containing a directional arrow:
- **Down chevron** = Struggled (amber background when selected: #FAEEDA fill, #BA7517 stroke)
- **Horizontal line** = Okay (gray background when selected)
- **Up chevron** = Nailed it (teal background when selected: #E1F5EE fill, #0F6E56 stroke)

Directional shape encodes meaning independently of color (accessible to colorblind users). A text label ("Struggled", "Okay", "Nailed it") appears on selection for the first few uses.

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

Each exercise shown with a colored dot (teal for completed, gray for skipped) and its rating in words ("Nailed it", "Struggled", "Skipped").

**Post-session suggestion:**

A coaching insight card (teal background) that combines backward-looking reflection and forward-looking motivation. Example: "You've practiced 4 of the last 7 days — one more this week matches your goal. Your Bruch slow practice is trending in the right direction: you struggled less on mm. 17–32 than last time."

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

**Not yet wireframed.** Planned contents:

- **Session history:** Chronological list of past sessions with date, session name, duration, and expandable detail (exercises, ratings, notes). Filterable by instrument, session type, and date range.
- **Analytics dashboard:** Practice frequency over time (chart), total time by period (this week vs. last week), average session duration trends, section-type distribution.
- **Exercise progress:** Per-exercise view showing ratings over time, notes history, and tempo/difficulty progression.
- **Pattern-level suggestions:** Structural coaching insights that surface here rather than on the Today tab. Example: "Your average session is 15 minutes shorter on weekends" or "You tend to skip cool-down sections."

### 5.8 Profile tab

**Not yet wireframed.** Contains:

- **Instruments:** Add, remove, configure instruments. Each instrument can have a practice frequency setting ("I aim to practice this: daily / a few times a week / weekly / occasionally") which calibrates the suggestions engine and the Today tab's instrument rotation.
- **Settings:** Suggestions opt-in/out (with a possible "fewer suggestions" middle option that limits suggestions to the session summary screen only). Other app preferences.
- **Account:** Clerk-managed authentication and profile.

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
| Post-session reflection | Session summary, coaching card | After finishing | "You've practiced 4 of the last 7 days — one more this week hits your goal." / "Your Bruch slow practice is trending: you struggled less on mm. 17–32 than last time." |
| Pattern-level insights | Progress tab | When reviewing stats | "Your average session is 15 min shorter on weekends." / "You tend to skip cool-down sections — these help with retention." |

### Design principles for suggestions

- Max one pre-session suggestion per visit to the Today tab.
- In-the-moment suggestions should be subtle — small expandable hint cards, not banners.
- Post-session suggestions should combine backward-looking reflection with forward-looking motivation.
- Suggestions should never appear as badge counts or notification dots (creates anxiety).
- Suggestions should never appear on the Plans tab (building/editing context) or Profile tab (admin context).

### User controls

- Global opt-out in Settings.
- "Fewer suggestions" option limits suggestions to the session summary screen only.
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
- **Template** — belongs to Instrument, has many Sessions (rotation units), has name, description, active/archived status
- **Session (template unit)** — belongs to Template, has name (user-provided), focus description, order in rotation, has many Sections
- **Section** — belongs to Session, has type (warm-up, scales, repertoire, etc.), has many Blocks, has estimated duration
- **Block** — belongs to Section, has name, description, estimated duration, metadata (tempo, key, difficulty), order in section. May reference a curated block from the library.
- **PracticeLog** — belongs to Instrument, optionally linked to a Template and Session. Has date, total duration, notes. Has many BlockLogs.
- **BlockLog** — belongs to PracticeLog, linked to a Block (or freeform). Has actual duration, rating (1=struggled, 2=okay, 3=nailed it), notes.
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
| `active-session.png` | Active session with progress bar, inline logging, chevron ratings, time steppers |
| `session-summary.png` | Post-practice summary with stats, exercise list, coaching suggestion |
| `quickstart-step1.png` | Wizard step 1: instrument selection |
| `quickstart-step2.png` | Wizard step 2: what are you working on |
| `quickstart-step3.png` | Wizard step 3: session area selection |
| `quickstart-step4.png` | Wizard step 4: time budget and plan preview |
| `template-editor.png` | Template editor with session tabs, section cards, block list |
| `block-library.png` | Add block screen with curated library and custom creation |
| `rating-chevrons.png` | Rating indicator design: chevron style with color |

### Wireframe conventions

- Wireframes are mobile-first (375px width) but the app is a responsive web app, not a native mobile app.
- Colors in wireframes are placeholder — final visual design and brand identity are not yet determined.
- Wireframes show structure and interaction patterns, not final copy or content.
