# Kantelo — Database Schema & API Design

> Technical reference for implementing the Kantelo backend. Designed from the product spec (kantelo-product-spec.md) as a greenfield schema.

**Last updated:** March 2026
**Stack:** FastAPI / SQLModel / PostgreSQL / Alembic / Clerk

---

## 1. Schema overview

### Entity hierarchy

```
User
├── UserSettings (1:1)
├── Instrument (1:many)
│   ├── Template (1:many)
│   │   └── TemplateSession (1:many, rotation units)
│   │       └── Section (1:many)
│   │           └── Block (1:many)
│   └── PracticeLog (1:many)
│       └── SectionLog (1:many)
│           └── BlockLog (1:many)
├── SuggestionDismissal (1:many)
└── (CuratedBlock — global library, not user-owned)
```

### Key design decisions

**SectionLog added as intermediate table.** The product spec's data model (section 9) lists PracticeLog → BlockLog directly. However, the active session UI has per-section time steppers with planned vs. actual duration, and sections are the unit that "completes" and fades back. SectionLog captures this cleanly and mirrors the template structure at the log level. Each SectionLog holds section-level duration; each BlockLog within it holds the rating and notes.

**Instruments are user-owned, not shared.** The old schema had a system instruments table with a join table. The spec just has instruments belonging to a user. If two users both play violin, they each have their own violin row. This is simpler and avoids permission complexity around shared entities.

**exercise_blocks + exercises collapse into blocks.** The old schema had a two-level hierarchy (exercise_blocks containing exercises). In the spec, each item in a section gets its own checkbox and rating — that's a Block. There's no sub-exercise level. The old "exercise" metadata (tempo, key, difficulty) moves onto Block.

**Rotation state lives on the template.** `current_rotation_index` on Template tracks which session is "next." Updated when a session is logged. Simpler than deriving from log history, and trivial to reset if needed.

**Ratings are directional integers.** -1 (step back), 0 (steady), 1 (step forward). Stored as smallint. This makes aggregation simple (AVG > 0 = trending forward) and avoids enum overhead.

**One active template per instrument.** Enforced by a unique partial index. The Today tab shows a single plan card per instrument — if multiple templates were active, the app would have to pick one or show all, creating exactly the decision fatigue Kantelo is designed to eliminate. Inactive templates are archived, not deleted, and can be reactivated at any time (which auto-deactivates the current one).

---

## 2. Enums

```python
from enum import Enum

class PracticeFrequency(str, Enum):
    daily = "daily"
    few_times_a_week = "few_times_a_week"
    weekly = "weekly"
    occasionally = "occasionally"

class SuggestionsPreference(str, Enum):
    all = "all"          # pre-session, in-the-moment, post-session, pattern-level
    fewer = "fewer"      # post-session + Insights tab only
    off = "off"          # no suggestions anywhere

class SectionType(str, Enum):
    warmup = "warmup"
    scales = "scales"
    repertoire = "repertoire"
    sight_reading = "sight_reading"
    ear_training = "ear_training"
    cooldown = "cooldown"
    other = "other"

class WeekStart(str, Enum):
    monday = "monday"
    sunday = "sunday"

class SuggestionTier(str, Enum):
    pre_session = "pre_session"
    in_the_moment = "in_the_moment"
    post_session = "post_session"
    pattern_level = "pattern_level"

class InteractionType(str, Enum):
    shown = "shown"
    dismissed = "dismissed"
    acted_on = "acted_on"
```

---

## 3. Table definitions

### users

No changes from existing schema. Clerk handles auth; this table stores the local user record.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | serial | PK | |
| clerk_user_id | varchar(255) | unique, not null, indexed | Clerk external ID |
| email | varchar(255) | not null | Synced from Clerk |
| first_name | varchar(255) | nullable | |
| last_name | varchar(255) | nullable | |
| created_at | timestamptz | not null, default now() | |
| updated_at | timestamptz | nullable, auto-update | |
| deleted_at | timestamptz | nullable | Soft delete |

### user_settings

One row per user, auto-created on first access.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | serial | PK | |
| user_id | int | FK → users, unique, not null | |
| suggestions_preference | varchar(20) | not null, default 'all' | SuggestionsPreference enum |
| default_session_duration_minutes | int | not null, default 30 | Used by quick-start wizard |
| week_starts_on | varchar(10) | not null, default 'monday' | WeekStart enum |
| created_at | timestamptz | not null, default now() | |
| updated_at | timestamptz | nullable, auto-update | |

### instruments

User-owned instruments with practice frequency.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | serial | PK | |
| user_id | int | FK → users, not null, indexed | |
| name | varchar(100) | not null | e.g. "Violin", "Horn" |
| practice_frequency | varchar(30) | not null, default 'few_times_a_week' | PracticeFrequency enum |
| display_order | int | not null, default 0 | For pill toggle ordering |
| created_at | timestamptz | not null, default now() | |
| updated_at | timestamptz | nullable, auto-update | |
| deleted_at | timestamptz | nullable | Soft delete |

Index: `(user_id, deleted_at)` — fetch active instruments for a user.

### templates

Practice plan belonging to an instrument. **At most one template per instrument can be active at a time.** This is enforced by a unique partial index and by the API's activation logic.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | serial | PK | |
| instrument_id | int | FK → instruments, not null, indexed | |
| name | varchar(200) | not null | e.g. "Learn the Bruch concerto" |
| description | text | nullable | |
| is_active | bool | not null, default true | Active vs. archived |
| current_rotation_index | int | not null, default 0 | Index into template_sessions ordering |
| created_at | timestamptz | not null, default now() | |
| updated_at | timestamptz | nullable, auto-update | |
| deleted_at | timestamptz | nullable | Soft delete |

Unique partial index: `CREATE UNIQUE INDEX uq_one_active_template_per_instrument ON templates (instrument_id) WHERE is_active = true AND deleted_at IS NULL;`

Activation logic (handled by `PATCH /api/templates/{id}` when `is_active` is set to `true`): the API auto-deactivates the currently active template for the same instrument before activating the new one. This ensures the constraint is never violated and the user doesn't have to manually deactivate the old plan.

When a user deactivates their only template (or has no templates), the Today tab falls back to "Practice off-plan" for that instrument. Inactive templates remain visible and browsable in the Plans tab and can be reactivated at any time.

### template_sessions

Named rotation units within a template. A single-session plan has one row; rotation plans have multiple.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | serial | PK | |
| template_id | int | FK → templates, not null, indexed | |
| name | varchar(200) | not null | e.g. "Technique focus", "Repertoire deep dive" |
| focus_description | text | nullable | Headline on Today tab: "Slow practice on mvt. II" |
| display_order | int | not null, default 0 | Position in rotation |
| created_at | timestamptz | not null, default now() | |
| updated_at | timestamptz | nullable, auto-update | |

Unique constraint: `(template_id, display_order)`.

### sections

Groups of blocks within a template session (warm-up, scales, repertoire, etc.).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | serial | PK | |
| template_session_id | int | FK → template_sessions, not null, indexed | |
| name | varchar(100) | not null | e.g. "Warm-up", "Scales" |
| section_type | varchar(30) | not null | SectionType enum |
| estimated_duration_minutes | int | not null, default 5 | Total time for this section |
| display_order | int | not null, default 0 | |
| created_at | timestamptz | not null, default now() | |
| updated_at | timestamptz | nullable, auto-update | |

### blocks

Individual exercises within a section. This is the atomic unit that gets a checkbox and a rating.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | serial | PK | |
| section_id | int | FK → sections, not null, indexed | |
| curated_block_id | int | nullable, FK → curated_blocks | If sourced from library |
| name | varchar(200) | not null | e.g. "G major scale, 3 octaves" |
| description | text | nullable | |
| estimated_duration_minutes | int | nullable | Per-block duration (optional; section duration is primary) |
| tempo_bpm | int | nullable | e.g. 72 |
| key | varchar(50) | nullable | e.g. "G major" |
| difficulty_level | int | nullable | 1–5 scale |
| display_order | int | not null, default 0 | |
| created_at | timestamptz | not null, default now() | |
| updated_at | timestamptz | nullable, auto-update | |

### curated_blocks

Global library of common practice blocks, organized by instrument type and section category.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | serial | PK | |
| instrument_category | varchar(100) | not null, indexed | e.g. "violin", "piano", "guitar" |
| name | varchar(200) | not null | e.g. "3-octave major scales" |
| description | text | nullable | Brief description for library display |
| section_type | varchar(30) | not null | SectionType — which section this fits in |
| default_duration_minutes | int | not null, default 5 | |
| usage_count | int | not null, default 0 | For popularity ranking |
| created_at | timestamptz | not null, default now() | |

Index: `(instrument_category, section_type)` — library queries filter by both.

### practice_logs

A logged practice session. One row per practice event.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | serial | PK | |
| user_id | int | FK → users, not null, indexed | |
| instrument_id | int | FK → instruments, not null, indexed | |
| template_id | int | nullable, FK → templates | Null for freeform sessions |
| template_session_id | int | nullable, FK → template_sessions | Which rotation session was practiced |
| practice_date | date | not null | |
| total_duration_minutes | int | not null | Summed from section logs |
| notes | text | nullable | Session-level freeform notes |
| reflection_prompt | text | nullable | Which rotating question was shown |
| reflection_response | text | nullable | User's answer |
| created_at | timestamptz | not null, default now() | |
| updated_at | timestamptz | nullable, auto-update | |
| deleted_at | timestamptz | nullable | Soft delete |

Indexes:
- `(user_id, instrument_id, practice_date)` — history queries, heatmap
- `(user_id, practice_date)` — streak calculation, cross-instrument analytics

### section_logs

Logged section within a practice session. Captures the per-section time stepper data.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | serial | PK | |
| practice_log_id | int | FK → practice_logs, not null, indexed | |
| section_id | int | nullable, FK → sections | Null for freeform sections |
| section_type | varchar(30) | not null | Denormalized from section (or user-assigned for freeform) |
| section_name | varchar(100) | not null | Denormalized for display |
| planned_duration_minutes | int | nullable | From template; null for freeform |
| actual_duration_minutes | int | not null | Adjusted via time stepper |
| display_order | int | not null, default 0 | |
| completed | bool | not null, default true | False if section was skipped |
| created_at | timestamptz | not null, default now() | |

### block_logs

Logged block within a section. The atomic rated unit.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | serial | PK | |
| section_log_id | int | FK → section_logs, not null, indexed | |
| block_id | int | nullable, FK → blocks | Null for freeform blocks |
| block_name | varchar(200) | not null | Denormalized for display |
| rating | smallint | nullable | -1 = step back, 0 = steady, 1 = step forward. Null if skipped. |
| notes | text | nullable | Per-exercise note |
| completed | bool | not null, default true | False if skipped |
| display_order | int | not null, default 0 | |
| created_at | timestamptz | not null, default now() | |

Index: `(section_log_id)` — fetch all blocks for a section log.

### suggestion_dismissals

Tracks which suggestion rules a user has dismissed, so they don't reappear.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | serial | PK | |
| user_id | int | FK → users, not null | |
| instrument_id | int | nullable, FK → instruments | Null if suggestion is cross-instrument |
| suggestion_rule_id | varchar(100) | not null | Identifies the rule (e.g. "scales_coverage_drop") |
| suggestion_tier | varchar(30) | not null | SuggestionTier enum |
| dismissed_at | timestamptz | not null, default now() | |

Unique constraint: `(user_id, instrument_id, suggestion_rule_id)` — one dismissal per rule per instrument per user.

### suggestion_interactions

Analytics/audit log of all suggestion events. Not used for app logic — used to evaluate suggestion quality over time.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | serial | PK | |
| user_id | int | FK → users, not null, indexed | |
| instrument_id | int | nullable, FK → instruments | |
| suggestion_rule_id | varchar(100) | not null | |
| suggestion_tier | varchar(30) | not null | SuggestionTier enum |
| suggestion_text | text | not null | The actual text shown |
| interaction_type | varchar(20) | not null | InteractionType enum |
| created_at | timestamptz | not null, indexed | |

---

## 4. API design

Base URL: `/api`

All endpoints except `GET /` and `GET /health` require Clerk authentication. User is resolved from the Clerk session token.

### Conventions

- List endpoints return arrays, optionally with pagination cursors.
- Create endpoints return the created resource with `201`.
- Update endpoints accept partial payloads (PATCH semantics) and return the updated resource.
- Delete endpoints return `204` (soft-delete where applicable).
- Nested resource creation uses the parent's URL. Reading/updating/deleting a resource uses its own flat URL.
- All timestamps are ISO 8601 with timezone. All dates are ISO 8601 (YYYY-MM-DD).

---

### Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | API name + version |
| GET | `/health` | Health check |

---

### User

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/user/me` | Current user profile. Auto-creates user record on first call if clerk_user_id doesn't exist yet. |

**Response:**
```json
{
  "id": 1,
  "email": "meg@example.com",
  "first_name": "Meg",
  "last_name": null,
  "created_at": "2026-03-01T..."
}
```

---

### Settings

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/settings` | Get user settings (auto-creates defaults if missing) |
| PATCH | `/api/settings` | Update settings |

**PATCH body (all fields optional):**
```json
{
  "suggestions_preference": "fewer",
  "default_session_duration_minutes": 45,
  "week_starts_on": "sunday"
}
```

---

### Instruments

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/instruments` | List user's active instruments, ordered by display_order |
| POST | `/api/instruments` | Create a new instrument |
| PATCH | `/api/instruments/{id}` | Update instrument (name, practice_frequency, display_order) |
| DELETE | `/api/instruments/{id}` | Soft-delete instrument and cascade to templates |

**POST body:**
```json
{
  "name": "Violin",
  "practice_frequency": "daily"
}
```

**GET response (list):**
```json
[
  {
    "id": 1,
    "name": "Violin",
    "practice_frequency": "daily",
    "display_order": 0,
    "active_template_count": 1,
    "last_practiced_at": "2026-03-23"
  }
]
```

`active_template_count` and `last_practiced_at` are computed fields — derived from templates and practice_logs respectively.

---

### Templates

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/instruments/{instrumentId}/templates` | List templates for an instrument |
| POST | `/api/instruments/{instrumentId}/templates` | Create template (auto-creates one session + default sections based on user settings) |
| GET | `/api/templates/{id}` | Full template with sessions → sections → blocks |
| PATCH | `/api/templates/{id}` | Update template metadata (name, description, is_active) |
| DELETE | `/api/templates/{id}` | Soft-delete template |

**GET /api/templates/{id} response:**
```json
{
  "id": 1,
  "instrument_id": 1,
  "name": "Learn the Bruch concerto",
  "description": null,
  "is_active": true,
  "current_rotation_index": 2,
  "sessions": [
    {
      "id": 1,
      "name": "Technique focus",
      "focus_description": "Slow practice on mvt. II",
      "display_order": 0,
      "estimated_duration_minutes": 25,
      "sections": [
        {
          "id": 1,
          "name": "Warm-up",
          "section_type": "warmup",
          "estimated_duration_minutes": 3,
          "display_order": 0,
          "blocks": [
            {
              "id": 1,
              "name": "Open string warm-up",
              "description": null,
              "estimated_duration_minutes": null,
              "tempo_bpm": null,
              "key": null,
              "difficulty_level": null,
              "display_order": 0
            }
          ]
        }
      ]
    }
  ]
}
```

`estimated_duration_minutes` on sessions is computed (sum of section durations).

---

### Template sessions (rotation units)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/templates/{id}/sessions` | Add a session to the rotation |
| PATCH | `/api/sessions/{id}` | Update session (name, focus_description) |
| DELETE | `/api/sessions/{id}` | Delete session (reorders remaining) |
| PUT | `/api/templates/{id}/sessions/reorder` | Reorder sessions in rotation |

**POST body:**
```json
{
  "name": "Repertoire deep dive",
  "focus_description": "Full run-through of exposition"
}
```

---

### Sections

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/sessions/{sessionId}/sections` | Add section to a session |
| PATCH | `/api/sections/{id}` | Update section (name, section_type, estimated_duration_minutes) |
| DELETE | `/api/sections/{id}` | Delete section and its blocks |
| PUT | `/api/sessions/{sessionId}/sections/reorder` | Reorder sections |

**POST body:**
```json
{
  "name": "Scales",
  "section_type": "scales",
  "estimated_duration_minutes": 5
}
```

---

### Blocks

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/sections/{sectionId}/blocks` | Add block to a section |
| PATCH | `/api/blocks/{id}` | Update block (name, tempo, key, duration, etc.) |
| DELETE | `/api/blocks/{id}` | Delete block |
| PUT | `/api/sections/{sectionId}/blocks/reorder` | Reorder blocks |

**POST body:**
```json
{
  "name": "G major scale, 3 octaves",
  "curated_block_id": 42,
  "tempo_bpm": 72,
  "key": "G major",
  "estimated_duration_minutes": 3
}
```

`curated_block_id` is optional — if provided, the block was sourced from the library. The name and other fields can still be customized.

---

### Curated block library

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/library/blocks` | Browse curated blocks. Query params: `instrument` (required), `section_type` (optional), `q` (search). Sorted by usage_count desc. |
| GET | `/api/library/recent` | Recently used blocks for the current user. Query params: `instrument_id` (required), `limit` (default 10). Returns blocks (both curated and freeform/quick-add) from the user's recent sessions, deduplicated by name, most recent first. |

**Response:**
```json
[
  {
    "id": 42,
    "name": "3-octave major scales",
    "description": "All 12 major scales, ascending and descending",
    "section_type": "scales",
    "default_duration_minutes": 5,
    "usage_count": 847,
    "usage_percentage": 73
  }
]
```

`usage_percentage` is computed: what percentage of users with this instrument include this block in a template.

---

### Today

The Today tab's data needs — which instruments are due, what's the current session for each.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/today` | Today context for all instruments |
| GET | `/api/today/{instrumentId}` | Today context for a specific instrument |

**GET /api/today response:**
```json
{
  "instruments_due": [
    {
      "instrument": { "id": 1, "name": "Violin", "practice_frequency": "daily" },
      "last_practiced_at": "2026-03-22",
      "days_since_last": 1,
      "repeat_available": true,
      "current_session": {
        "template_id": 1,
        "template_name": "Learn the Bruch concerto",
        "session_id": 3,
        "session_name": "Technique focus",
        "focus_description": "Slow practice on mvt. II",
        "rotation_position": "session 3 of 7",
        "estimated_duration_minutes": 25,
        "section_types": ["warmup", "scales", "repertoire", "cooldown"]
      }
    }
  ],
  "instruments_not_due": [
    {
      "instrument": { "id": 3, "name": "Horn", "practice_frequency": "weekly" },
      "last_practiced_at": "2026-03-16",
      "days_since_last": 7,
      "next_due_description": "due this week"
    }
  ]
}
```

`repeat_available` is true when the user's most recent session on this instrument used the same template_session_id that's currently queued. When true, the frontend shows a "Repeat last session" shortcut.
```

"Due" logic: compare `last_practiced_at` against `practice_frequency`. Daily = due every day. Few times a week = due if ≥ 2 days since last. Weekly = due if ≥ 5 days since last. Occasionally = never auto-surfaced, only shown in pill toggle.

---

### Practice (session lifecycle)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/practice/start` | Start a practice session (creates PracticeLog + scaffolded SectionLogs/BlockLogs from template, or empty for freeform) |
| GET | `/api/practice/{logId}` | Get in-progress or completed session with all section/block logs |
| PATCH | `/api/practice/{logId}` | Update session-level fields (notes) |
| PUT | `/api/practice/{logId}/sections/{sectionLogId}` | Update a section log (actual_duration_minutes, completed) |
| PUT | `/api/practice/{logId}/blocks/{blockLogId}` | Update a block log (rating, notes, completed) |
| POST | `/api/practice/{logId}/sections` | Add a freeform section mid-session |
| POST | `/api/practice/{logId}/sections/{sectionLogId}/blocks` | Add a freeform block to a section |
| POST | `/api/practice/{logId}/finish` | Finish session — calculates totals, advances rotation, returns summary |

**POST /api/practice/start body:**
```json
{
  "instrument_id": 1,
  "template_id": 1,
  "template_session_id": 3
}
```

For freeform: omit `template_id` and `template_session_id`.

**Smart tempo defaults:** When scaffolding block logs from a template, the `start` endpoint looks up the user's most recent BlockLog for each block_id and includes a `last_tempo_bpm` field on each block log in the response. The frontend uses this to pre-fill the tempo display. If no previous log exists for a block, `last_tempo_bpm` is null and the block's template-defined `tempo_bpm` is shown instead.

**Section-level actions** (mark all done, skip section) are handled by `PUT /api/practice/{logId}/sections/{sectionLogId}` with body `{ "mark_all_done": true }` or `{ "completed": false }`. The backend updates all child block logs accordingly when `mark_all_done` is true (sets completed=true on all blocks without changing ratings) or when the section is skipped (sets completed=false on the section and all its blocks).

**POST /api/practice/{logId}/finish response:**
```json
{
  "practice_log": { "...full log with section_logs and block_logs..." },
  "summary": {
    "total_duration_minutes": 27,
    "exercises_completed": 4,
    "exercises_total": 5,
    "day_streak": 6,
    "ratings": { "step_forward": 2, "steady": 1, "step_back": 1, "skipped": 1 }
  },
  "coaching_suggestion": {
    "text": "You've practiced 4 of the last 7 days — one more this week...",
    "rule_id": "weekly_consistency"
  },
  "reflection_prompt": "What felt different today?"
}
```

The `finish` endpoint handles:
1. Summing section durations into `total_duration_minutes`
2. Advancing `current_rotation_index` on the template (wrapping around)
3. Generating the post-session coaching suggestion
4. Selecting a reflection prompt (random from pool, excluding last 3 shown)

---

### Practice — reflection

| Method | Path | Description |
|--------|------|-------------|
| PATCH | `/api/practice/{logId}/reflection` | Save the reflection response |

**Body:**
```json
{
  "reflection_response": "Felt more relaxed in the left hand. Maybe the new warm-up is helping..."
}
```

Separated from `finish` because the user writes it after viewing the summary.

---

### Progress — History

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/progress/history` | Paginated session history. Query params: `instrument_id` (optional), `period` (all/week/month), `cursor`, `limit` (default 20) |
| GET | `/api/progress/history/{logId}` | Full session detail (same as GET /api/practice/{logId}) |

**Response (list):**
```json
{
  "items": [
    {
      "id": 42,
      "practice_date": "2026-03-23",
      "instrument_name": "Violin",
      "session_name": "Slow practice on mvt. II",
      "template_name": "Learn the Bruch concerto",
      "rotation_label": "session 3 of 7",
      "total_duration_minutes": 27,
      "exercise_count": 5,
      "is_freeform": false
    }
  ],
  "next_cursor": "eyJ..."
}
```

History items are the collapsed card view. Expanding a card fetches the full detail via the detail endpoint.

---

### Progress — Insights

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/progress/insights/heatmap` | Practice calendar heatmap data. Query params: `instrument_id` (required), `year` (default: current). Returns daily practice duration. |
| GET | `/api/progress/insights/comparison` | This week vs. last. Query params: `instrument_id` (required). Returns days practiced, total time, and daily breakdown for both weeks. |
| GET | `/api/progress/insights/ratings` | Rating trend. Query params: `instrument_id` (required), `weeks` (default: 4). Returns step_back/steady/step_forward counts per week. |

**GET /api/progress/insights/heatmap response:**
```json
{
  "year": 2026,
  "days": [
    { "date": "2026-01-06", "duration_minutes": 25 },
    { "date": "2026-01-08", "duration_minutes": 35 }
  ]
}
```

Frontend renders the heatmap grid from this flat list. Days with no entry are gaps (no practice). Intensity is derived client-side from duration.

**GET /api/progress/insights/comparison response:**
```json
{
  "this_week": {
    "days_practiced": 4,
    "total_minutes": 102,
    "daily": [
      { "day": "monday", "minutes": 27 },
      { "day": "tuesday", "minutes": 22 },
      { "day": "wednesday", "minutes": 35 },
      { "day": "thursday", "minutes": 18 },
      { "day": "friday", "minutes": 0 },
      { "day": "saturday", "minutes": 0 },
      { "day": "sunday", "minutes": 0 }
    ]
  },
  "last_week": { "...same shape..." },
  "delta_days": 1,
  "delta_minutes": 27
}
```

Week boundaries use the user's `week_starts_on` setting.

**GET /api/progress/insights/ratings response:**
```json
{
  "weeks": [
    {
      "week_start": "2026-03-17",
      "step_back": 3,
      "steady": 8,
      "step_forward": 12,
      "total": 23
    },
    { "...previous weeks..." }
  ]
}
```

---

### Suggestions

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/suggestions/pre-session` | Get a pre-session suggestion for the Today tab. Query params: `instrument_id` (required). Returns at most 1 suggestion. |
| GET | `/api/suggestions/in-session/{logId}` | Get in-the-moment suggestions for an active session. Returns suggestions keyed by block_log_id. |
| POST | `/api/suggestions/dismiss` | Dismiss a suggestion |
| POST | `/api/suggestions/interact` | Log a suggestion interaction (for analytics) |

**GET /api/suggestions/pre-session response:**
```json
{
  "suggestion": {
    "rule_id": "scales_coverage_drop",
    "tier": "pre_session",
    "text": "Your scales coverage has dropped off — consider adding a scales block today."
  }
}
```

Returns `{ "suggestion": null }` if no suggestion applies or user has dismissed the relevant rule.

**GET /api/suggestions/in-session/{logId} response:**
```json
{
  "suggestions": {
    "47": {
      "rule_id": "previous_session_note",
      "text": "Last session you noted: \"Intonation still shaky in the top octave of mm. 24–28. Try slower next time.\""
    }
  }
}
```

Keys are block_log_ids. Only includes blocks where a suggestion applies.

**POST /api/suggestions/dismiss body:**
```json
{
  "rule_id": "scales_coverage_drop",
  "instrument_id": 1,
  "tier": "pre_session"
}
```

---

## 5. Suggestion rules (v1)

The five rules referenced in the product spec. Each rule has an ID, a tier, and query logic.

| Rule ID | Tier | Logic |
|---------|------|-------|
| `consistency_nudge` | pre_session | Fires when days since last practice exceeds the instrument's frequency threshold. |
| `section_coverage_drop` | pre_session | Fires when a section type (e.g. scales) hasn't appeared in the last N sessions but was common before. |
| `previous_block_note` | in_the_moment | Surfaces the user's own note from the last time they practiced this specific block. |
| `tempo_progression` | in_the_moment | Suggests increasing tempo when the last 2+ sessions on a block were rated "step forward." |
| `weekly_consistency` | post_session | Compares days practiced this week to the user's effective goal (derived from frequency setting). Also surfaces block-level trends (step forward streaks, step back patterns). |

Pattern-level suggestions (Progress tab) are derived from the same data but with longer time horizons. These can share rule infrastructure but fire on different triggers (page view rather than session lifecycle).

---

## 6. Migration notes

Since this is a greenfield rebuild:

1. Drop all existing tables (or create a fresh database).
2. Create a single Alembic migration with all tables defined above.
3. Seed `curated_blocks` with a starter set per instrument category (violin, viola, cello, piano, guitar, flute, voice).
4. The old 23-migration history can be archived or discarded.

If any seed data from the old schema is worth preserving (curated block definitions, system templates), it can be extracted as JSON fixtures and loaded into the new schema shape.
