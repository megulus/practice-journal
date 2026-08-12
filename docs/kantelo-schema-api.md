# Kantelo — Database Schema & API Design

> Technical reference for implementing the Kantelo backend. Designed from the product spec (kantelo-product-spec.md) as a greenfield schema.

**Last updated:** July 2026
**Stack:** FastAPI / SQLModel / PostgreSQL / Alembic / Clerk

---

## 1. Schema overview

### Entity hierarchy

```
User
├── UserSettings (1:1)
├── Instrument (1:many)
│   ├── Piece (1:many)
│   │   └── Spot (1:many)
│   ├── Template (1:many)
│   │   └── TemplateSession (1:many, rotation units)
│   │       └── Section (1:many)
│   │           └── Block (1:many)
│   │               └── TemplateBlockSpot (1:many, repertoire blocks only)
│   │                   → Spot
│   └── PracticeLog (1:many)
│       └── SectionLog (1:many)
│           └── BlockLog (1:many)
│               → Spot (nullable, repertoire blocks only)
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

**Repertoire is per-instrument.** Pieces belong to a single instrument. The same piece practiced on two instruments is two distinct Piece rows with independent spot lists and histories. This matches how musicians actually experience repertoire — fingerings, bowings, and trouble spots don't transfer across instruments.

**Pieces and spots persist independently of templates.** The repertoire library is owned by the instrument, not by any template. Templates reference pieces (and their spots) through repertoire-flavored blocks. This means a piece's history survives template archival, deletion, and rebuilding.

**Blocks come in two flavors, sharing one table.** A standard block has a name, optional tempo/key/etc., and optionally references a CuratedBlock. A repertoire block has a `piece_id` and an associated default spot list (via the `template_block_spots` join table) and inherits its display name from the piece. The two flavors live in the same `blocks` table, distinguished by whether `piece_id` is set. This avoids a polymorphic mess and keeps section ordering simple. A check constraint enforces that a block cannot be both a curated standard block and a repertoire block simultaneously.

**BlockLog gains a nullable spot_id.** When a session is logged against a repertoire block, each spot practiced gets its own BlockLog row with `spot_id` set. A "logged against the whole piece without picking spots" entry is a single BlockLog with `spot_id = null`. This lets pressed-for-time logging coexist with granular spot tracking.

**Spots have a `retired_at` timestamp**, not a boolean. Retired spots are filtered out of default views by `retired_at IS NULL`. Un-retiring sets it back to null. This preserves the retirement timestamp for analytics and possible coaching ("you retired this spot 6 weeks ago").

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

class ThemePreference(str, Enum):
    system = "system"    # follow the OS light/dark setting
    light = "light"
    dark = "dark"

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
| theme_preference | varchar(10) | not null, default 'system' | ThemePreference enum |
| created_at | timestamptz | not null, default now() | |
| updated_at | timestamptz | nullable, auto-update | |

### instruments

User-owned instruments with practice frequency.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | serial | PK | |
| user_id | int | FK → users, not null, indexed | |
| name | varchar(100) | not null | User-editable, e.g. "Violin", "Mom's Violin", "Horn" |
| instrument_category | varchar(100) | not null, indexed | Canonical category for curated-block lookups, e.g. "violin" |
| practice_frequency | varchar(30) | not null, default 'few_times_a_week' | PracticeFrequency enum |
| display_order | int | not null, default 0 | For pill toggle ordering |
| created_at | timestamptz | not null, default now() | |
| updated_at | timestamptz | nullable, auto-update | |
| deleted_at | timestamptz | nullable | Soft delete |

Index: `(user_id, deleted_at)` — fetch active instruments for a user.
Index: `instrument_category` — curated-library usage stats group by it.

**instrument_category** is what `curated_blocks.instrument_category` is matched
against; `name` never is. It is derived from `name` on creation by
`app/services/instrument_category.py`, which owns the canonical category list
(`violin`, `viola`, `cello`, `piano`, `guitar`, `flute`, `voice` — the same list
the curated-block seed data is keyed by). Derivation normalizes the name
(lowercase, punctuation → spaces, apostrophes dropped) and matches a canonical
category appearing as a word anywhere in it, so decoration is tolerated: "Mom's
Violin" → `violin`, "Backup viola" → `viola`, "1/2 size Cello" → `cello`. When
nothing matches it falls back to the normalized name ("Stage Strad" → `stage
strad`).

On rename the category follows the new name only when that name resolves to a
canonical category — "Violin" → "Cello" becomes `cello`, and "Violn" → "Violin"
recovers `violin`. Otherwise an existing canonical category is kept, so "Violin"
→ "Stage Strad" stays `violin` and curated search keeps working; a fallback
category simply tracks the name. Clients may also send `instrument_category`
explicitly on create or update, which wins over derivation.

### pieces

Per-instrument repertoire library entries. Created lazily — typically the first time a user adds a repertoire block to a template or starts logging against a piece.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | serial | PK | |
| instrument_id | int | FK → instruments, not null, indexed | |
| name | varchar(300) | not null | e.g. "Bruch Violin Concerto in G minor, Op. 26" |
| composer_or_source | varchar(200) | nullable | e.g. "Max Bruch" or "trad." |
| created_at | timestamptz | not null, default now() | |
| updated_at | timestamptz | nullable, auto-update | |
| deleted_at | timestamptz | nullable | Soft delete |

Index: `(instrument_id, deleted_at)` — fetch active pieces for an instrument.

### spots

Sub-units of a piece that the user actually practices. Named in the user's own vocabulary ("first page," "trouble spots mm. 24–28," "the B section").

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | serial | PK | |
| piece_id | int | FK → pieces, not null, indexed | |
| name | varchar(200) | not null | e.g. "first page", "trouble spots mm. 24–28" |
| location | varchar(300) | nullable | Free-text, no parsing. e.g. "mm. 24–28", "page 3", "letter C to E" |
| display_order | int | not null, default 0 | For ordering within the piece |
| retired_at | timestamptz | nullable | Set when retired; null when active. Distinct from deleted_at. |
| created_at | timestamptz | not null, default now() | |
| updated_at | timestamptz | nullable, auto-update | |
| deleted_at | timestamptz | nullable | Soft delete (distinct from retire) |

Indexes:
- `(piece_id, deleted_at, retired_at)` — fetch active spots for a piece
- `(piece_id, retired_at)` — fetch all spots including retired

### templates

Practice plan belonging to an instrument. **At most one template per instrument can be active at a time.** This is enforced by a unique partial index and by the API's activation logic.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | serial | PK | |
| instrument_id | int | FK → instruments, not null, indexed | |
| user_id | int | FK → users, not null, indexed | Denormalized owner for user-scoped queries (avoids joining through instruments) |
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

Individual exercises within a section. This is the atomic unit that gets a checkbox and a rating. Comes in two flavors:

- **Standard block:** has name, description, optional tempo/key/difficulty, optionally references a CuratedBlock. `piece_id` is null.
- **Repertoire block:** has `piece_id` set; inherits its display name from the referenced Piece. The `name`, `tempo_bpm`, `key`, `difficulty_level`, and `curated_block_id` fields are ignored for repertoire blocks (the API does not surface them). The repertoire block's default spot list is fetched via the `template_block_spots` join table.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | serial | PK | |
| section_id | int | FK → sections, not null, indexed | |
| curated_block_id | int | nullable, FK → curated_blocks | If sourced from library |
| piece_id | int | nullable, FK → pieces | If set, this is a repertoire block |
| name | varchar(200) | nullable for repertoire blocks, otherwise not null | e.g. "G major scale, 3 octaves" |
| description | text | nullable | |
| estimated_duration_minutes | int | nullable | Per-block duration (optional; section duration is primary) |
| tempo_bpm | int | nullable | e.g. 72 |
| key | varchar(50) | nullable | e.g. "G major" |
| difficulty_level | int | nullable | 1–5 scale |
| display_order | int | not null, default 0 | |
| created_at | timestamptz | not null, default now() | |
| updated_at | timestamptz | nullable, auto-update | |

Check constraint: `CHECK ((piece_id IS NULL) OR (curated_block_id IS NULL))` — a block cannot simultaneously be a curated standard block and a repertoire block.

### template_block_spots

Join table linking a repertoire Block to its default Spots. The "default spot list" pre-selected when starting a session from the parent template.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | serial | PK | |
| block_id | int | FK → blocks, not null, indexed | The repertoire block |
| spot_id | int | FK → spots, not null, indexed | Default spot for this block |
| display_order | int | not null, default 0 | |
| created_at | timestamptz | not null, default now() | |

Unique constraint: `(block_id, spot_id)` — a spot can't be in the same block's default list twice.

When a spot is hard-deleted, rows in this table are cascade-deleted. When a spot is retired, this table is unaffected (the join still exists; the active session UI filters retired spots out of the pre-selected list but they remain accessible via "show retired").

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
| status | varchar(20) | not null, default 'in_progress' | Session lifecycle (`SessionStatus` enum): `'in_progress'` while active, `'completed'` once finished, `'abandoned'` if discarded. Indexed via `(user_id, status)` for active-session lookups |
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
- `(user_id, status)` — active ("in_progress") session lookup for the Today tab resume banner

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
| skipped | bool | not null, default false | Explicitly skipped by the user (distinct from "not started"). Lossless — skipping only sets this flag; child block completion and ratings are preserved, so un-skipping restores the section exactly |
| created_at | timestamptz | not null, default now() | |

### block_logs

Logged block within a section. The atomic rated unit. For repertoire blocks, each spot practiced gets its own row; logging against a piece without picking spots produces a single row with `spot_id = null`.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | serial | PK | |
| section_log_id | int | FK → section_logs, not null, indexed | |
| block_id | int | nullable, FK → blocks | Null for freeform blocks |
| spot_id | int | nullable, FK → spots, ON DELETE SET NULL | Set for repertoire-block logs scoped to a specific spot |
| block_name | varchar(300) | not null | Denormalized for display. For repertoire: piece name, or "{piece} — {spot}" |
| rating | smallint | nullable | -1 = step back, 0 = steady, 1 = step forward. Null if skipped. |
| notes | text | nullable | Per-exercise (or per-spot) note |
| completed | bool | not null, default true | False if skipped |
| display_order | int | not null, default 0 | |
| tempo_bpm | int | nullable | Tempo logged in this session, set when the user confirms or adjusts the pre-filled tempo field. Null until then. Feeds the next session's `last_tempo_bpm` |
| created_at | timestamptz | not null, default now() | |

Indexes:
- `(section_log_id)` — fetch all blocks for a section log
- `(spot_id, created_at)` — spot-level history queries and rating trends

When a spot is hard-deleted, BlockLogs referencing it have their `spot_id` set to null (via `ON DELETE SET NULL`), and `block_name` is preserved as the historical record. Retiring a spot does not affect its BlockLogs.

`block_name` is display text, not a parseable pair: a piece titled `"Sonata — No. 2"` produces `"Sonata — No. 2 — mm. 1–8"`, which no splitting rule can take back apart. Clients that need the piece on its own read the `piece_name` field on the block-log read schema (see "Piece name on block logs" under the practice endpoints), which resolves it from the relationship rather than from the string.

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
  "week_starts_on": "sunday",
  "theme_preference": "dark"
}
```

---

### Instruments

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/instruments` | List user's active instruments, ordered by display_order |
| POST | `/api/instruments` | Create a new instrument |
| PATCH | `/api/instruments/{id}` | Update instrument (name, practice_frequency, display_order, instrument_category) |
| DELETE | `/api/instruments/{id}` | Soft-delete instrument and cascade to templates |

**POST body:** (`instrument_category` optional — derived from `name` when omitted)
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
    "instrument_category": "violin",
    "practice_frequency": "daily",
    "display_order": 0,
    "active_template_count": 1,
    "template_count": 2,
    "piece_count": 3,
    "last_practiced_at": "2026-03-23"
  }
]
```

`active_template_count`, `template_count`, `piece_count`, and
`last_practiced_at` are computed fields.

`active_template_count` counts live templates with `is_active = true`;
`template_count` counts every live template, archived ones included. The second
is what `DELETE /api/instruments/{id}` cascades to — that cascade filters on
`deleted_at` alone — so confirmation copy warning about the cascade must use
`template_count`, not `active_template_count`.

---

### Pieces

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/instruments/{instrumentId}/pieces` | List pieces for an instrument. Query params: `include_retired_spots` (default false) |
| POST | `/api/instruments/{instrumentId}/pieces` | Create a piece |
| GET | `/api/pieces/{id}` | Full piece detail with spots |
| PATCH | `/api/pieces/{id}` | Update piece (name, composer_or_source) |
| DELETE | `/api/pieces/{id}` | Soft-delete piece (cascades to spots; preserves block_logs with denormalized names) |

**POST body:**
```json
{ "name": "Bruch Violin Concerto in G minor, Op. 26", "composer_or_source": "Max Bruch" }
```

**GET /api/pieces/{id} response:**
```json
{
  "id": 7,
  "instrument_id": 1,
  "name": "Bruch Violin Concerto in G minor, Op. 26",
  "composer_or_source": "Max Bruch",
  "spots": [
    {
      "id": 12,
      "name": "first page",
      "location": "mm. 1–32",
      "display_order": 0,
      "retired_at": null,
      "session_count": 8,
      "last_practiced_at": "2026-03-23"
    },
    {
      "id": 13,
      "name": "trouble spots",
      "location": "mm. 24–28",
      "display_order": 1,
      "retired_at": "2026-02-10T...",
      "session_count": 6,
      "last_practiced_at": "2026-02-09"
    }
  ]
}
```

`session_count` and `last_practiced_at` are computed from block_logs.

---

### Spots

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/pieces/{pieceId}/spots` | Create a spot |
| PATCH | `/api/spots/{id}` | Update spot (name, location, display_order) |
| POST | `/api/spots/{id}/retire` | Retire (sets retired_at = now) |
| POST | `/api/spots/{id}/unretire` | Un-retire (sets retired_at = null) |
| DELETE | `/api/spots/{id}` | Soft-delete (distinct from retire; sets deleted_at) |
| PUT | `/api/pieces/{pieceId}/spots/reorder` | Reorder spots within a piece |
| GET | `/api/spots/{id}/history` | Spot's practice history — block logs over time, with rating trend |

**POST /api/pieces/{pieceId}/spots body:**
```json
{ "name": "first page", "location": "mm. 1–32" }
```

`location` is optional and free-text.

**GET /api/spots/{id}/history response:**
```json
{
  "spot": { "id": 12, "name": "first page", "location": "mm. 1–32", "retired_at": null },
  "logs": [
    {
      "block_log_id": 482,
      "practice_date": "2026-03-23",
      "rating": 1,
      "notes": "Felt smoother through the bowing change at m. 16",
      "session_id": 91
    }
  ],
  "rating_trend": { "step_back": 1, "steady": 3, "step_forward": 4, "skipped": 0 }
}
```

---

### Templates

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/instruments/{instrumentId}/templates` | List templates for an instrument |
| POST | `/api/instruments/{instrumentId}/templates` | Create template (auto-creates one session + default sections based on user settings) |
| GET | `/api/templates/{id}` | Full template with sessions → sections → blocks |
| PATCH | `/api/templates/{id}` | Update template metadata (name, description, is_active) |
| DELETE | `/api/templates/{id}` | Soft-delete template |
| POST | `/api/templates/{id}/duplicate` | Duplicate template. Body: `{ "copy_default_spots": true }` (defaults to true) |

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
              "piece_id": null,
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

`estimated_duration_minutes` on sessions is computed (sum of section durations). For repertoire blocks, the response also includes `piece_name` and a `default_spots` array (see "Blocks" section below).

**Template duplication.** When `copy_default_spots` is true, the new template's repertoire blocks reference the same Pieces and the same Spot entities — the spots themselves are not duplicated. Both templates contribute to the same spot histories. When false, repertoire blocks are created with an empty default spot list; the user populates them in the editor.

The frontend shows a confirmation dialog: "Copy spots from the original plan? You can always edit them later." with default "Yes, copy spots."

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
| POST | `/api/sections/{sectionId}/blocks` | Add block to a section (standard or repertoire flavor) |
| PATCH | `/api/blocks/{id}` | Update block (name, tempo, key, duration, etc.) |
| DELETE | `/api/blocks/{id}` | Delete block |
| PUT | `/api/sections/{sectionId}/blocks/reorder` | Reorder blocks |
| POST | `/api/blocks/{blockId}/default-spots` | Add a spot to a repertoire block's default list |
| DELETE | `/api/blocks/{blockId}/default-spots/{spotId}` | Remove a spot from the default list (does not retire or delete the spot) |
| PUT | `/api/blocks/{blockId}/default-spots/reorder` | Reorder the default spot list |

**POST body (standard block):**
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

**POST body (repertoire block):**
```json
{
  "piece_id": 7,
  "default_spot_ids": [12, 14, 15]
}
```

When `piece_id` is set, `name`, `tempo_bpm`, `key`, `difficulty_level`, and `curated_block_id` are ignored. The check constraint enforces that a block cannot simultaneously be a curated standard block and a repertoire block.

**Response (repertoire block):**
```json
{
  "id": 203,
  "section_id": 41,
  "piece_id": 7,
  "piece_name": "Bruch Violin Concerto in G minor, Op. 26",
  "default_spots": [
    { "id": 12, "name": "first page", "location": "mm. 1–32", "display_order": 0 },
    { "id": 14, "name": "development", "location": null, "display_order": 1 },
    { "id": 15, "name": "trouble spots", "location": "mm. 24–28", "display_order": 2 }
  ],
  "display_order": 3
}
```

**POST /api/blocks/{blockId}/default-spots body:**
```json
{ "spot_id": 16 }
```

---

### Curated block library

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/library/blocks` | Browse curated blocks. Query params: `instrument` (required — a canonical `instruments.instrument_category`, e.g. `violin`, **not** an instrument name), `section_type` (optional), `q` (search). Sorted by usage_count desc. |
| GET | `/api/library/recent` | Recently used blocks for the current user. Query params: `instrument_id` (required), `limit` (default 10). Returns blocks (both curated and freeform/quick-add) from the user's recent sessions, deduplicated by name, most recent first. |
| GET | `/api/library/repertoire` | Pieces from the user's repertoire library, formatted for the block library "Your repertoire" tab. Query params: `instrument_id` (required), `include_retired` (default false) |

**GET /api/library/blocks response:**
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

`usage_percentage` is computed: what percentage of users with an instrument in this category (`instruments.instrument_category`) include this block in a template.

**GET /api/library/repertoire response:**
```json
{
  "pieces": [
    {
      "id": 7,
      "name": "Bruch Violin Concerto in G minor, Op. 26",
      "composer_or_source": "Max Bruch",
      "active_spot_count": 3,
      "last_practiced_at": "2026-03-23",
      "spots": [
        { "id": 12, "name": "first page", "location": "mm. 1–32" },
        { "id": 14, "name": "development", "location": null },
        { "id": 15, "name": "trouble spots", "location": "mm. 24–28" }
      ]
    }
  ]
}
```

Only active (non-retired, non-deleted) spots are returned by default. A `?include_retired=true` param surfaces retired spots as well, for cases where the user wants to re-add a retired spot to a template block.

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

"Due" logic: compare `last_practiced_at` against `practice_frequency`. Daily = due every day. Few times a week = due if ≥ 2 days since last. Weekly = due if ≥ 5 days since last. Occasionally = never auto-surfaced, only shown in pill toggle.

---

### Quick start

One call behind the quick-start wizard (product spec §5.6). The wizard renders
a live plan preview before anything is persisted, so the *balancing* happens on
the frontend and this endpoint takes the finished section list; its job is to
commit instrument + piece + plan atomically instead of through ~15 CRUD calls
that can half-fail.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/quickstart` | Create instrument (or reuse one), optional first piece, and an active single-session plan |

**POST /api/quickstart request:**
```json
{
  "instrument_name": "Violin",
  "plan_name": "Bruch Violin Concerto",
  "piece_name": "Bruch Violin Concerto",
  "sections": [
    {
      "name": "Warm-up",
      "section_type": "warmup",
      "estimated_duration_minutes": 5,
      "block": { "name": "Warm-up", "description": "Easy playing to loosen up" }
    },
    {
      "name": "Repertoire",
      "section_type": "repertoire",
      "estimated_duration_minutes": 15,
      "block": { "name": "Bruch Violin Concerto", "description": "Slow practice on what you are learning" }
    }
  ]
}
```

- Send **exactly one** of `instrument_id` (reuse an existing instrument) or
  `instrument_name` (create one; the category is derived from the name). Both,
  or neither, is a 422; an id owned by another user is a 404.
- `piece_name` is optional (blank counts as omitted). When present it becomes a
  `Piece` in the instrument's library with no spots, and the `repertoire`
  section's block becomes a repertoire block pointing at it (its `name` is
  nulled — repertoire blocks take their display name from the piece). Without a
  piece, that section keeps a plain named block.
- Each section gets exactly one seed block, whose
  `estimated_duration_minutes` mirrors the section's.
- The plan is created **active**; the instrument's previously active plan is
  deactivated in the same transaction (one active template per instrument).
- The total of the section durations is written to
  `user_settings.default_session_duration_minutes`.

**Response `201`:** `{ "instrument": InstrumentRead, "template": TemplateRead, "template_session_id": int, "piece": PieceRead | null }`

---

### Practice (session lifecycle)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/practice/start` | Start a practice session (creates PracticeLog + scaffolded SectionLogs/BlockLogs from template, or empty for freeform) |
| GET | `/api/practice/{logId}` | Get in-progress or completed session with all section/block logs |
| PATCH | `/api/practice/{logId}` | Update session-level fields (notes) |
| PUT | `/api/practice/{logId}/sections/{sectionLogId}` | Update a section log (actual_duration_minutes, completed) |
| PUT | `/api/practice/{logId}/blocks/{blockLogId}` | Update a block log (rating, notes, completed, tempo_bpm) |
| POST | `/api/practice/{logId}/sections` | Add a freeform section mid-session |
| POST | `/api/practice/{logId}/sections/{sectionLogId}/blocks` | Add a freeform block to a section |
| POST | `/api/practice/{logId}/blocks/{blockLogId}/spots` | Create a new spot on the parent piece and add a BlockLog for it to this session |
| PUT | `/api/practice/{logId}/blocks/{blockLogId}/collapse-to-piece` | Collapse per-spot logs of a repertoire block into a single piece-level log |
| PUT | `/api/practice/{logId}/blocks/{blockLogId}/expand-to-spots` | Reverse of collapse — restore per-spot block logs from the block's default spot list |
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

**Smart tempo defaults:** Both `start` and `GET /api/practice/{logId}` include a `last_tempo_bpm` field on each block log — the tempo to pre-fill the block row's tempo field with. It is sourced only from block logs in the user's **completed** sessions for that block_id: the most recent `BlockLog.tempo_bpm` they logged, or, if they never logged one there, that block's template-defined `tempo_bpm`. A block the user has never practised in a completed session returns null even when the template sets a tempo, and the field renders empty. `GET` computes it too so a mid-session reload pre-fills the same values `start` returned. What the user actually logs today is the separate `tempo_bpm` field on the block log (null until they confirm or adjust the pre-filled value).

**Piece name on block logs.** Every block-log read carries `piece_name` — the repertoire piece's name, resolved from the relationship (`block_logs.block_id → blocks.piece_id → pieces.name`), not derived from `block_name`. It is the display name for the piece header that groups a repertoire block's spot rows, and the prefix a client strips to show a spot row on its own; `block_name` cannot serve either purpose when the title itself contains `" — "`. It is null for standard and freeform blocks. Two degradation cases:

- The piece (or its spots) was soft-deleted — the lookup deliberately ignores `deleted_at`, so `piece_name` still resolves and the historical log renders in full.
- The template block was hard-deleted, so `block_id` is null — there is nothing to resolve and `piece_name` is null. Clients fall back to `block_name`, which is exactly the record it's denormalized to be.

The field is present on `start`, `GET /api/practice/{logId}`, `GET /api/progress/history/{logId}`, and on the mutation responses that return block logs (`PUT .../blocks/{blockLogId}`, add-freeform-block, add-spot, collapse-to-piece, expand-to-spots, and the section-level `PUT` that nests them).

**Repertoire block scaffolding.** When the start endpoint scaffolds SectionLogs and BlockLogs from a template, repertoire blocks are expanded into one BlockLog per default spot. Each BlockLog has `spot_id` set, `block_name` denormalized to `"{piece_name} — {spot_name}"`, and starts with `completed = false` and `rating = null`.

If a repertoire block has zero default spots, the start endpoint creates a single placeholder BlockLog with `spot_id = null` and `block_name = piece_name`. The user can then add spots inline via the active session UI, which converts the placeholder into per-spot logs (or leaves it as a piece-level log if they choose to log against the whole piece).

**Section-level actions** (mark all done, skip section) are handled by `PUT /api/practice/{logId}/sections/{sectionLogId}` with body `{ "mark_all_done": true }` or `{ "completed": false }`. The backend updates all child block logs accordingly when `mark_all_done` is true (sets completed=true on all blocks without changing ratings) or when the section is skipped (sets completed=false on the section and all its blocks).

**Adding a spot mid-session.** `POST /api/practice/{logId}/blocks/{blockLogId}/spots` body:

```json
{
  "name": "cadenza",
  "location": null,
  "add_to_rotation": true
}
```

`add_to_rotation` defaults to true and controls whether the new spot is also added to the source repertoire block's `template_block_spots`. When false, the spot is created on the piece but not added to the template's defaults. The endpoint resolves the parent piece via the BlockLog → SectionLog → PracticeLog → (template_session_id → ... → block.piece_id) chain. For freeform sessions, the caller must also provide the piece_id explicitly.

**Logging against the whole piece (pressed-for-time path).** `PUT /api/practice/{logId}/blocks/{blockLogId}/collapse-to-piece` body:

```json
{ "rating": 0, "notes": null }
```

This deletes the per-spot BlockLogs for that block in this session and creates a single BlockLog with `spot_id = null` and `block_name` = piece name. The reverse operation (`expand-to-spots`) restores per-spot BlockLogs from the block's default spot list. In practice, the frontend may prefer to track this state locally and only commit the chosen flavor on finish, rather than round-tripping. Either approach is supported.

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

The five core rules referenced in the product spec, plus four spot-level rules enabled by the repertoire model. Each rule has an ID, a tier, and query logic.

| Rule ID | Tier | Logic |
|---------|------|-------|
| `consistency_nudge` | pre_session | Fires when days since last practice exceeds the instrument's frequency threshold. |
| `section_coverage_drop` | pre_session | Fires when a section type (e.g. scales) hasn't appeared in the last N sessions but was common before. |
| `previous_block_note` | in_the_moment | Surfaces the user's own note from the last time they practiced this specific block. |
| `tempo_progression` | in_the_moment | Suggests increasing tempo when the last 2+ sessions on a block were rated "step forward." |
| `weekly_consistency` | post_session | Compares days practiced this week to the user's effective goal (derived from frequency setting). Also surfaces block-level trends (step forward streaks, step back patterns). |
| `spot_step_forward_streak` | in_the_moment | Fires when a spot's last 3+ block_logs are all rated step_forward. Suggests advancing — next page, faster tempo, or new section. |
| `spot_plateau` | post_session | Fires when a spot's last 5+ block_logs are predominantly steady with no step_forward in 2+ weeks. Suggests changing approach. |
| `retired_spot_check` | pattern_level | Fires when a spot has been retired for 4+ weeks. Suggests a quick check-in to verify it's still solid. |
| `whole_piece_overuse` | pattern_level | Fires when the user has logged against a piece's piece-level (no spot) more than 5 times in a row, suggesting they might benefit from picking spots. |

Pattern-level suggestions (Progress tab) are derived from the same data but with longer time horizons. These can share rule infrastructure but fire on different triggers (page view rather than session lifecycle). Spot-level rules use the same dismissal and opt-out mechanism as the core rules.

---

## 6. Migration notes

Since this is a greenfield rebuild:

1. Drop all existing tables (or create a fresh database).
2. Create a single Alembic migration with all tables defined above.
3. Seed `curated_blocks` with a starter set per instrument category (violin, viola, cello, piano, guitar, flute, voice).
4. The old 23-migration history can be archived or discarded.

If any seed data from the old schema is worth preserving (curated block definitions, system templates), it can be extracted as JSON fixtures and loaded into the new schema shape.
