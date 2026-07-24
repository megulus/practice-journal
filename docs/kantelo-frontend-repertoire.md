# Kantelo frontend — Repertoire surfaces

> Design decisions for the two repertoire-related frontend surfaces designed so far: the **active session repertoire block** (where most repertoire interaction happens, day to day) and the **template editor repertoire block management** (where users configure default spot lists when building plans). Both surfaces share components — particularly the spot row, the location field with smart-insert chips, and the search-doubles-as-create pattern.

This document supersedes the earlier `kantelo-frontend-repertoire-active-session.md` note and adds the template editor surface.

The third repertoire surface — the **Profile repertoire library** (browsing pieces, viewing spot history, retiring/un-retiring, deleting) — is not yet designed. It is the lowest-stakes surface (used occasionally for management) and will inherit components from the two designed here.

> **This is design intent, not build status.** The active-session surface is built (#145); the template-editor spot management is designed but not yet built (#167); the Profile repertoire library is not yet designed. For what's actually shipped vs. planned, see the GitHub Project board and open issues — not this document.

**Status:** Active session and template editor surfaces both settled. Profile repertoire library still to design.
**Last updated:** April 2026

---

## Part 1 — Active session repertoire block

### Summary

A repertoire block is a visually distinct nested container inside a Repertoire section of the active session. It contains a piece header and a list of spot rows, with affordances for whole-piece logging, collapse, inline spot creation, and one-tap re-add of recently practiced spots.

### Structure at rest

The repertoire block is a nested card with a clear piece-header band at the top and an indented spot list beneath it. The piece is a container, not a label — this lets the piece header host its own controls (notably the whole-piece logging affordance) and makes multi-piece sessions readable at a glance.

#### Piece header

Four elements, with the piece name dominating:

- **Piece checkbox** (left). Three states: unchecked, indeterminate (some spots checked), checked-as-one. Tapping the checkbox is the mode switch into whole-piece logging.
- **Piece name** (center). The visually dominant element.
- **Collapse chevron** (right). Rotates between expanded (`⌄`) and collapsed (`>`). Collapsing hides the spot list and shows a count line under the piece name. The piece checkbox stays live in the collapsed state so pressed-for-time whole-piece logging works without expanding.
- **Overflow menu** (right). Piece-level actions: rename, view in repertoire library, etc. Kept small and quiet.

#### Spot rows

Indented one level beneath the piece header. Each spot row contains:

- A checkbox (in its own visual column from the piece checkbox because of the indent — the relationship reads as parent/child)
- The spot name
- The optional location text (smaller, secondary, beneath the name)
- Rating chevrons (↓ — ↑)
- A small "add note" toggle that expands an inline note field, same as regular exercise rows

A spot row's structure is deliberately similar to a regular exercise row so users don't have to learn a new pattern. The differences are: it lives nested inside a piece, and it has an optional location.

### Whole-piece logging (the pressed-for-time path)

The piece checkbox is the affordance for "log this piece as a single unit" — used when the user is short on time, doesn't want to track individual spots today, or just wants to mark the piece practiced and move on.

Tapping the piece checkbox switches the block into **checked-as-one** mode:

- The spot list visually fades (heavy opacity reduction, individual checkboxes disabled but still visible)
- A single rating row appears at the piece level, with its own chevrons and a small "Logging as one piece" label
- The piece is being logged as a unit; no per-spot logs are created

Tapping the piece checkbox again unchecks it and restores the spots to their previous state.

This is a **mode switch**, not a completion mark. The metaphor works because checking a parent item in a nested list naturally implies "mark the whole thing." The first time a user taps the piece checkbox expecting a normal action, the visual feedback (spots fading, single rating row appearing, label text) makes the new state immediately legible — and unchecking restores everything, so the surprise is forgiving.

The piece checkbox shows an **indeterminate** state (the dash-in-a-box pattern from nested todo lists) when the user has checked one or more spots individually but not the piece itself. This makes the parent/child relationship visible without claiming the piece is "done."

#### Why faded spots, not hidden

In whole-piece mode, the spots remain visible but heavily faded rather than hidden entirely. Two reasons: it preserves the user's sense of "this piece has structure I usually engage with," and it makes the reverse gesture (tap the piece checkbox again) feel more obviously reversible because the spots are still there waiting.

#### Why a checkbox, not a "log as one" link

An earlier draft used a small "log as one" text link on the piece header. We rejected it because the phrase only makes sense to users who've already absorbed Kantelo's piece/spot vocabulary. A checkbox is self-evident: of course checking the piece logs the piece. The principle: users should not need to learn Kantelo's internal vocabulary to use the app.

### Collapse and expand

The collapse chevron on the piece header hides the spot list and shows a compact count line under the piece name. Collapse is included in v1 (not deferred), for two reasons:

1. **Long histories.** A user practicing a piece for six months may have eight active spots; even if they only practice three of them today, seeing all eight every session is noise. Collapse lets them focus on what's relevant.
2. **The audition/multi-piece edge case.** A violinist preparing for an audition might have a concerto, a Bach partita, orchestral excerpts, and chamber parts all under Repertoire. Without collapse, this becomes a wall of spots. With collapse, they can focus on one piece at a time without losing track of the others.

The collapsed state preserves the piece checkbox as a live control so whole-piece logging still works without expanding.

### Skipping spots for today

There is no special "skip" affordance. A spot row already has a checkbox; if the user never checks it, the session finishes with that spot logged as `completed = false`, no rating, and it shows up in the session summary as "Skipped" (light-gray dot). This is identical to how regular exercise rows behave — no new mechanic, no new mental model.

Unchecked spots are **not** visually de-emphasized during the session, even after the user has engaged with other spots. De-emphasizing before the session ends would imply a decision the user hasn't made yet.

Note: tapping the piece-level checkbox to log-as-one is **not** the same as skipping the spots. In whole-piece mode, the spots aren't logged individually at all — the data model records a single piece-level BlockLog and the summary renders one row for the whole piece, not "Skipped" rows for each spot.

### Adding a spot mid-session

At the bottom of the spot list, two thin elements (in this order):

**A row of recently-practiced spot chips.** Hidden when there's nothing relevant to show. Tapping a chip adds the spot to today's log instantly, no input required. The chip disappears once added (it's now a normal spot row above).

**A single-line quick-add input.** Placeholder "Add a spot...", mic button on the right, submit on Enter. Below the input: a small checkbox labeled **"Save for next time"**, defaulted on.

The flow is ruthlessly fast: type or dictate a name, hit enter, the spot appears as a normal spot row above the input, ready to be checked and rated. The input clears for the next addition. No location, no metadata, no decisions — just a name.

#### What the "Save for next time" checkbox does

When checked (the default), the new spot is added both to the piece's repertoire library *and* to this template block's default spot list — so it shows up automatically next session. When unchecked, the spot is created on the piece but not added to the template's defaults, useful for one-off explorations.

The phrasing "Save for next time" was chosen to describe the user-facing effect rather than the data-model effect. It avoids Kantelo jargon ("Add to rotation") and the slightly opaque "Add to this plan's defaults."

#### Why location isn't captured here

Location is genuinely optional, and the in-session quick-add is the moment when friction matters most. Adding a location field — even an optional one — adds visual weight and an implicit decision ("do I fill this in now?") at exactly the wrong moment. Location lives on the editing surfaces (template editor and Profile repertoire library) instead.

#### What counts as "recent" for the chip row

Any spot from this piece that was practiced in the user's last 5 sessions on this instrument *and* is not already in today's log. Five sessions catches spots from the last week or two without dragging in stuff from a month ago. The number can be tuned with real usage data. Retired spots are excluded — surfacing them here would undermine the retirement gesture.

### Vertical-space concerns

A repertoire block takes more vertical space than a standard block because of the header band, the indented spot list, the chip row, and the quick-add input. In the common case (one or two pieces with three to five spots each), this is fine. In the edge case (an audition violinist with four pieces and many spots), it would be a wall.

Mitigations, in order of how much they help:

1. **Collapse** is the primary mitigation. A user can collapse pieces they're not actively working on right now.
2. **Completed sections fade back**, just like they already do for regular sections.
3. The piece header is **compact** — one line — so even an expanded piece with several spots is shorter than it would be with a heavier header.

---

## Part 2 — Template editor repertoire block

### Summary

In the template editor, a repertoire block lives in the section's block list as a single compact row showing the piece name and a spot count. Tapping the block opens a bottom-sheet drawer with focused spot management — the current default spot list, plus a search-doubles-as-create flow for adding more spots.

### Why a drawer, not inline expansion

Two patterns were considered: inline expansion in place (the block expands within the section's block list) vs. a focused drawer that opens on tap.

The drawer won because:

- The template editor is a **setup surface**, used a handful of times per plan, not constantly. Optimizing for "clean and scannable" over "zero context switch" is the right tradeoff when editing is rare.
- Most spot adding and editing actually happens during practice sessions, not during template construction. When a user *is* in the template editor working on a piece, they're typically focused on that one piece — the drawer matches that focus.
- Inline expansion makes the section editor visually heavy as soon as one repertoire block is open. Multiple pieces in a Repertoire section would compound the problem. The drawer keeps the section view compact regardless.

### Adding a repertoire block to a section

Repertoire blocks are added through the existing block library sheet, which gains a **"Your repertoire"** tab alongside the Curated and Recently used tabs.

The "Your repertoire" tab uses the same **search-doubles-as-create** pattern that the existing Curated tab uses for custom block creation: a search input at the top filters the user's existing pieces; if nothing matches the typed text, a "Create '[name]'" affordance appears at the bottom of the results.

- Tapping an existing piece adds an empty repertoire block (the piece is referenced, but no default spots are pre-populated) to the section and closes the library.
- Tapping "Create" opens a small inline form for the new piece — name (pre-filled from the search input) and an optional composer/source field — then commits and adds the empty repertoire block.

Default spots are configured *after* the block is added, in the spot management drawer. This keeps the library sheet's mental model simple ("a picker that returns one thing per visit") and gives spot configuration a single canonical surface.

### The repertoire block in the section list

A repertoire block in the section editor's block list shows:

- The piece name
- A spot count ("3 spots")
- A drag handle for reordering, same as other blocks
- An overflow menu for block-level actions (delete the block from the section, etc.)

That's the entire visual footprint at rest. Tapping anywhere on the row opens the spot management drawer.

### Spot management drawer

A bottom sheet that slides up from the bottom of the screen, anchored to the section editor in the background. Contents:

**Header:** The piece name (large) and a "Done" affordance to close the drawer.

**Default spots list:** The current spots in this template block's default list, in order. Each row shows the spot name, optional location text beneath, a drag handle for reordering, and a remove (×) action. Removing here removes the spot from this template block's defaults — it does **not** retire or delete the spot at the piece level.

**"+ Add spot" affordance** at the bottom of the list. Tapping it reveals an inline search input.

#### Adding a spot — the search-doubles-as-create flow

Tapping "+ Add spot" reveals a search input at the bottom of the drawer (same visual treatment as the search input in the block library's "Your repertoire" tab — consistent pattern). Typing filters the piece's spots not currently in this template block's defaults.

Results are organized in two sections:

**ON THIS PIECE** — active spots from the piece that aren't in this template's defaults yet. Each result shows the spot name, location, and a "last practiced N days ago" hint. Tapping a result adds it to this template block's defaults immediately — one tap, no confirmation, fully reversible.

**RETIRED** — retired spots from the piece that match the search. Each result is faded slightly (to reinforce the visual distinction from active spots) and shows when it was retired ("retired 6 weeks ago"). Tapping a retired result triggers a small inline confirmation: "Bring back '[spot name]'? It was retired N weeks ago. This will un-retire it and add it to this plan." with "Cancel" and "Bring back" buttons.

The retired confirmation isn't a heavy modal — it's a small panel that replaces the search results temporarily. The extra tap preserves the deliberateness of the retire/un-retire gesture without forcing the user to navigate away to the Profile repertoire library. Active spots add with one tap; retired spots add with two.

**Create "[name]"** appears at the bottom of the results when the typed text doesn't exactly match any active or retired spot. Tapping it opens the new-spot creation form (see below). If the typed text exactly matches an existing spot (active or retired), the create link does not show — there's no risk of accidentally creating a duplicate.

#### Creating a brand-new spot

Tapping "Create" opens a focused form within the drawer, replacing the search results temporarily. The form has:

- **Name field** (required, pre-filled from the search input). Mic button for voice input.
- **Location field** (optional). Mic button for voice input. Below the field, a row of **smart-insert chips**: `mm.` / `page` / `letter` / `to` / `–`. Tapping a chip inserts text at the cursor position. The chip order adapts to the user's history — chips used recently surface first.
- A primary **"Create"** button at the bottom.
- A **"Cancel"** affordance in the form header.

Tapping "Create" creates the spot on the piece, adds it to this template block's defaults, closes the form, and returns to the drawer's main view with the new spot visible in the default spots list.

The button is labeled simply "Create" rather than "Add to defaults" because in the editor context, creating a spot and adding it to this template block's defaults are the same action — there's no ambiguity about what will happen. This also means the editor spot creation does **not** need the "Save for next time" checkbox we have in the active session, because the editor's whole purpose is configuring the template's defaults; the answer is always yes.

### Why the same search pattern in two places

The "Your repertoire" tab in the block library and the "+ Add spot" search in the spot management drawer use the same visual treatment and the same search-doubles-as-create logic. This is intentional: it's one pattern that the user learns once and applies in both places. The only difference is what's being searched — pieces in the library, spots in the drawer — and what "Create" produces.

The pattern is also consistent with the existing custom block creation flow on the Curated tab of the block library, so it builds on something users already know rather than introducing a new interaction.

---

## Components introduced

This design adds the following to the Phase 1 and Phase 2 component inventories in `kantelo-frontend-plan.md`:

### Active session

| Component | Notes |
|-----------|-------|
| `RepertoireBlock` | The nested container. Contains a `PieceHeader`, a list of `SpotRow`s, a `RecentSpotChips` row, and a `SpotQuickAdd` input. Manages the per-spot vs. whole-piece mode state locally, syncs to backend on rating/check changes. |
| `PieceHeader` | Four-element header band: piece checkbox (with indeterminate state support), piece name, collapse chevron, overflow menu. Renders the count line under the name when collapsed. |
| `SpotRow` | Structurally similar to `ExerciseRow` but with optional location text and reduced metadata. Reuses the existing checkbox, rating chevrons, and note toggle components. **Reused by the template editor drawer.** |
| `RecentSpotChips` | Horizontal row of tappable chips. Hidden when empty. |
| `SpotQuickAdd` | Single-line input + mic button + "Save for next time" checkbox. Voice-first, enter-to-submit. |
| `WholePieceRatingRow` | The rating row that appears in checked-as-one mode. Inline label ("Logging as one piece") + rating chevrons. |

### Template editor

| Component | Notes |
|-----------|-------|
| `RepertoireBlockRow` | The compact one-line representation of a repertoire block in the section's block list. Piece name, spot count, drag handle, overflow menu. |
| `SpotManagementDrawer` | Bottom sheet with the piece header, the current default spots list, and the add-spot flow. |
| `SpotSearchInput` | The search input used in both the block library's "Your repertoire" tab and the drawer's "+ Add spot" flow. Search-doubles-as-create logic. |
| `SpotSearchResults` | Renders results in ON THIS PIECE and RETIRED sections, plus the "Create" affordance when no exact match. |
| `RetiredSpotConfirmPanel` | The small inline confirmation panel that appears when the user taps a retired spot in search results. |
| `SpotEditForm` | The new-spot creation form: name field, location field with smart-insert chips, Create button. **Reused by the Profile repertoire library.** |
| `LocationInput` | The location field component with the smart-insert chips row beneath. Adaptive chip ordering based on user history. **Reused by the Profile repertoire library.** |

The `SpotRow`, `SpotEditForm`, and `LocationInput` components are the foundation that the future Profile repertoire library will inherit.

---

## API touchpoints

This UI exercises the following endpoints from `kantelo-schema-api.md`:

### Active session

- `POST /api/practice/start` — scaffolds repertoire blocks with one BlockLog per default spot
- `PUT /api/practice/{logId}/blocks/{blockLogId}` — updates rating/notes/completed on a spot's block log
- `POST /api/practice/{logId}/blocks/{blockLogId}/spots` — creates a new spot mid-session, with `add_to_rotation` flag from the "Save for next time" checkbox
- `PUT /api/practice/{logId}/blocks/{blockLogId}/collapse-to-piece` — switches into whole-piece mode
- `PUT /api/practice/{logId}/blocks/{blockLogId}/expand-to-spots` — switches back to per-spot mode
- The "recently practiced spots" chip row needs a query — either a new endpoint (`GET /api/pieces/{pieceId}/recent-spots?exclude_log_id=X`) or a field added to the existing `POST /api/practice/start` response that includes recent-spot candidates per repertoire block. The latter avoids an extra round trip; worth deciding when implementing.

The frontend may prefer to track collapse/expand state and per-spot vs. whole-piece mode locally and only commit on session finish, rather than round-tripping every mode switch. Either approach is supported by the API.

### Template editor

- `GET /api/library/repertoire` — populates the "Your repertoire" tab in the block library
- `POST /api/instruments/{instrumentId}/pieces` — creates a new piece from the library's create flow
- `POST /api/sections/{sectionId}/blocks` (with `piece_id`) — adds a repertoire block to a section
- `GET /api/pieces/{id}` — fetches the full piece detail when the spot management drawer opens, so the search can filter against all spots on the piece (including retired). May want a `?include_retired=true` query param if not on by default.
- `POST /api/blocks/{blockId}/default-spots` — adds an existing spot to the template block's defaults
- `DELETE /api/blocks/{blockId}/default-spots/{spotId}` — removes a spot from the defaults (does not retire/delete)
- `PUT /api/blocks/{blockId}/default-spots/reorder` — drag-to-reorder
- `POST /api/pieces/{pieceId}/spots` — creates a new spot from the create form (then `POST /api/blocks/{blockId}/default-spots` adds it to the template's defaults — or the backend can support a single combined call as a future optimization)
- `POST /api/spots/{id}/unretire` — un-retires a spot when the user confirms "Bring back" from the retired confirmation panel

---

## Wireframes produced

The following wireframes have been designed and rendered in conversation. They should be screenshot-captured and saved into `/docs/wireframes/`:

| File | Description |
|------|-------------|
| `active-session-repertoire-default.png` | Active session repertoire block in default per-spot mode: piece header, three indented spot rows with checkboxes and rating chevrons, recently-practiced chip row, quick-add input with "Save for next time" checkbox |
| `active-session-repertoire-whole-piece.png` | Active session repertoire block in whole-piece mode: piece checkbox checked (teal), spots faded, single rating row with "Logging as one piece" label |
| `template-editor-repertoire-drawer-default.png` | Template editor spot management drawer at rest: piece name, default spots list with three rows, "+ Add spot" affordance |
| `template-editor-repertoire-drawer-search-success.png` | Search results showing both active and retired matches, with the create link at the bottom |
| `template-editor-repertoire-drawer-confirm-unretire.png` | Inline "Bring back" confirmation panel when the user taps a retired spot result |
| `template-editor-repertoire-drawer-create-form.png` | New-spot creation form: name field, location field with smart-insert chips row, Create button |
| `template-editor-add-block-library-empty.png` | Block library "Your repertoire" tab in empty state, showing the search-doubles-as-create input |

Wireframes still on the TODO list (not yet designed):

| File | Description |
|------|-------------|
| `repertoire-library.png` | Profile repertoire library: per-instrument piece list, expandable to show active and retired spots, with management affordances |
| `quickstart-step4-repertoire.png` | Wizard step 4: optional "anything you're working on" question |

The earlier `template-editor-repertoire.png` and `block-library-repertoire-tab.png` placeholders in the product spec's wireframe TODO list are now superseded by the more specific files above.

---

## Open questions for the Profile repertoire library

Not blockers for the surfaces designed here, but will need to be settled when designing the third surface:

- **Editing a spot's name and location.** The overflow menu on a spot row needs an "Edit spot" action. Where does it open — inline edit, drawer, modal? The `SpotEditForm` component is reusable; the question is the container.
- **Retiring a spot from inside the active session.** The spot's overflow menu also needs a "Retire from rotation" action, with no confirmation dialog (per the product spec). Visual feedback when a spot is retired mid-session — does it disappear immediately, or fade and move to a "retired this session" group?
- **Per-spot history view.** The `GET /api/spots/{id}/history` endpoint exists; the question is what the history view looks like (list of practice dates with ratings? a small rating-trend chart? both?).
- **Hard-deleting a spot vs. retiring it.** Both actions exist. Where in the UI do they live, and how do we make the distinction obvious to the user?
- **Whole-piece mode and the recently-practiced chips.** When a piece is in checked-as-one mode in the active session, the chip row is meaningless (you can't add individual spots to a piece you're logging as a unit). The chip row should hide in that mode — small implementation detail to remember.
