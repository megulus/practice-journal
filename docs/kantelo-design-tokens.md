# Kantelo — Design Tokens & Visual Identity

> The complete design system reference for implementing Kantelo's frontend. Every value here is a decision — don't improvise.

**Last updated:** July 2026 — verified in sync with `frontend/src/lib/tokens.css` and `frontend/tailwind.config.ts`
**Direction:** Clean Edge + Warm Stone (IBM Plex Sans, tight radii, warm neutral palette)
**Modes:** Light and Dark, both first-class

---

## 1. Design philosophy

Precise but not cold. Bold but not loud. Warm without being soft.

Kantelo looks like a high-quality tool that takes your craft seriously. The warmth comes from the background tone and neutral palette — not from rounded corners, pastel colors, or playful illustrations. Every element earns its space. The design should feel like opening a well-made instrument case: clean, purposeful, ready.

**Key principles:**
- **Warm stone, not clinical white.** The page background has a barely-perceptible warm undertone that softens the overall feel without compromising precision.
- **Cards lift off the surface.** Pure white cards on the warm stone background create clear visual hierarchy through tone contrast, not shadows.
- **Tight radii, clean edges.** 8–10px corners on interactive elements. Nothing bubbly.
- **One typeface, three weights.** IBM Plex Sans at 400, 500, and 600. No display fonts, no serif accents.
- **Teal is the hero color.** It appears on primary actions, positive states, and active indicators. Everything else is neutral.
- **Amber is the coaching color.** Suggestions, nudges, and "step back" states use amber tones. It's warm and noticeable without being alarming.

---

## 2. Color tokens

### Page & surface

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `page-bg` | #F7F6F3 | #1C1B18 | Page/screen background |
| `card-bg` | #FFFFFF | #242320 | Cards, panels, elevated surfaces |
| `card-bg-inset` | #F0EFEB | #242320 | Section headers, inset areas within cards |
| `input-bg` | #FFFFFF | #242320 | Text inputs, textareas |
| `input-bg-recessed` | #F7F6F3 | #242320 | Note fields, recessed inputs within cards |

### Text

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `text-primary` | #1A1915 | #EDECE8 | Headings, body text, exercise names |
| `text-secondary` | #9B968C | #7A756B | Subheadings, metadata, plan source |
| `text-tertiary` | #B5B0A5 | #5C5850 | Hints, timestamps, inactive labels |
| `text-on-primary-action` | #FFFFFF | #FFFFFF | Text on primary buttons |
| `text-link` | #0D6B52 | #2DB88A | Links, "add note" toggles, interactive text |

### Borders

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `border-default` | #E0DED8 | #33312B | Card borders, dividers, section separators |
| `border-subtle` | #F0EFEB | #2A2925 | Exercise row separators, light dividers |
| `border-input` | #D4D0C8 | #3D3A33 | Input borders, pill borders, stepper buttons |
| `border-input-focus` | #0D6B52 | #2DB88A | Focused input border |

### Primary (teal) — actions, positive states

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `primary` | #0D6B52 | #2DB88A | Start button, checkboxes, active nav, progress bar |
| `primary-hover` | #0A5C46 | #25A57A | Button hover state |
| `primary-subtle-bg` | #D8F3E9 | #162E24 | "Step forward" chevron bg, cool-down pill bg, teal badge bg |
| `primary-subtle-text` | #0A5C46 | #5ECAA5 | Text on primary-subtle-bg |
| `primary-subtle-border` | #5ECAA5 | #2A7A5C | "Step forward" chevron border |

### Amber — coaching, suggestions, "step back"

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `amber-bg` | #FFFBF5 | #2A2318 | Suggestion card background |
| `amber-border` | #EEDCBE | #4A3D28 | Suggestion card border |
| `amber-icon-bg` | #D98A2B | #D98A2B | Suggestion icon background (same both modes) |
| `amber-text` | #6E5020 | #D4A85C | Suggestion body text |
| `amber-text-muted` | #C49E5C | #8A7040 | Dismiss link on suggestions |
| `amber-subtle-bg` | #FAEEDA | #332A18 | "Step back" chevron bg |
| `amber-subtle-text` | #9A7020 | #D4A85C | "Step back" chevron icon and text |
| `amber-subtle-border` | #D4A44A | #6B5528 | "Step back" chevron border |

### Section type colors

Section colors appear on pills (Today tab, plan card) and pips (active session section headers). Rather than assigning a unique global color to every section type, Kantelo uses two **pinned colors** with semantic meaning and an **8-color pool** assigned by display order within a template session.

**Pinned colors** (always assigned to these section types):

| Section type | Pill bg (light) | Pill text (light) | Pill bg (dark) | Pill text (dark) | Pip color |
|--------------|----------------|-------------------|----------------|------------------|-----------|
| Warm-up | #FEF0EA | #A84820 | #33221A | #E8845A | #D85A30 |
| Cool-down | #D8F3E9 | #0A5C46 | #162E24 | #5ECAA5 | #1D9E75 |

**Color pool** (assigned in order to all non-pinned sections within a template session):

| # | Name | Pill bg (light) | Pill text (light) | Pill bg (dark) | Pill text (dark) | Pip color |
|---|------|----------------|-------------------|----------------|------------------|-----------|
| 1 | Blue | #E6F0FD | #1A5C9E | #1A2533 | #6AACEC | #378ADD |
| 2 | Purple | #EEEDFD | #4842A6 | #22203A | #9B94E0 | #7F77DD |
| 3 | Amber | #FFF4E5 | #8A5E15 | #332A18 | #E8A840 | #D98A2B |
| 4 | Pink | #FBEAF0 | #993556 | #2E1A22 | #E07A9E | #D4537E |
| 5 | Indigo | #EAECFA | #3444A0 | #1E2040 | #8B9AE0 | #4A5BC7 |
| 6 | Copper | #F5EBE5 | #7A4530 | #302018 | #D4906A | #B0694E |
| 7 | Slate blue | #EBF0F5 | #3E6080 | #1A2530 | #8AB4D4 | #5A7FA0 |
| 8 | Olive | #EFF3E5 | #4A6520 | #222818 | #A4C468 | #6B8C42 |

**Assignment rules:**
- If the section type is Warm-up or Cool-down, use the pinned color. Always.
- For all other section types, assign pool colors in display_order within the template session. The first non-pinned section gets Blue (#1), the second gets Purple (#2), etc.
- Color assignment is stable within a template — "Scales" always gets the same color in a given session. But "Scales" in template A might be Blue while "Scales" in template B might be Purple, depending on display order.
- If a session somehow has more than 8 non-pinned sections, wrap around to #1. In practice this is extremely unlikely — most sessions have 3–5 sections total.
- The pool is defined as an ordered array in the frontend: `const SECTION_COLOR_POOL = ['blue', 'purple', 'amber', 'pink', 'indigo', 'copper', 'slate_blue', 'olive']`

### Rating states

| State | Chevron bg (light) | Chevron border (light) | Chevron icon (light) | Chevron bg (dark) | Chevron border (dark) | Chevron icon (dark) |
|-------|-------------------|----------------------|---------------------|-------------------|----------------------|---------------------|
| Step back | #FAEEDA | #D4A44A | #9A7020 | #332A18 | #6B5528 | #D4A85C |
| Steady | #F0EFEB | #D4D0C8 | #9B968C | #2A2925 | #3D3A33 | #7A756B |
| Step forward | #D8F3E9 | #5ECAA5 | #0A5C46 | #162E24 | #2A7A5C | #5ECAA5 |
| Unselected | transparent | #E0DED8 | #B5B0A5 | transparent | #33312B | #5C5850 |

### Active/selected states

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `pill-active-bg` | #1A1915 | #EDECE8 | Active instrument pill, active toggle |
| `pill-active-text` | #F7F6F3 | #1C1B18 | Text on active pill |
| `pill-inactive-border` | #D4D0C8 | #3D3A33 | Inactive pill border |
| `pill-inactive-text` | #7A756B | #9B968C | Inactive pill text |
| `nav-active` | #0D6B52 | #2DB88A | Active bottom nav item |
| `nav-inactive` | #B5B0A5 | #5C5850 | Inactive bottom nav item |

### Coaching card (post-session)

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `coaching-bg` | #D8F3E9 | #162E24 | Post-session coaching card |
| `coaching-text` | #085041 | #9FE1CB | Coaching card body text |

### Heatmap (Insights)

Five intensity levels on the teal ramp:

| Level | Light | Dark | Meaning |
|-------|-------|------|---------|
| Empty | #F0EFEB | #2A2925 | No practice |
| Light | #9FE1CB | #1A5040 | Short session |
| Medium | #5DCAA5 | #0F6E56 | Moderate session |
| Dark | #1D9E75 | #2DB88A | Long session |
| Full | #0F6E56 | #5ECAA5 | Intense session |

### Danger / destructive

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `danger-text` | #A32D2D | #F09595 | Sign out, delete actions |

---

## 3. Typography

**Typeface:** IBM Plex Sans

Load via Google Fonts: `IBM+Plex+Sans:wght@400;500;600`

| Token | Size | Weight | Letter-spacing | Usage |
|-------|------|--------|----------------|-------|
| `heading-lg` | 24px | 600 | -0.5px | Tab headers ("Today's practice", "Progress") |
| `heading-md` | 18px | 600 | -0.3px | Plan card focus text, session summary header |
| `heading-sm` | 15px | 600 | -0.2px | Active session title, section labels in context |
| `body` | 13px | 400 | 0 | Plan source, suggestion text, exercise names, general content |
| `body-medium` | 13px | 500 | 0 | Section card labels, pill text, stepper values |
| `label` | 11px | 500 | 0.8px | Uppercase section labels ("SESSION 3 OF 7"), filter pills |
| `caption` | 11px | 400 | 0 | Metadata (tempo, key), timestamps, rating labels, hint text |
| `caption-small` | 10px | 500 | 0 | Bottom nav labels |

**Line heights:**
- Headings: 1.35
- Body text: 1.5
- Captions: 1.4

---

## 4. Spacing

Base unit: 4px. Use multiples.

| Token | Value | Usage |
|-------|-------|-------|
| `space-xs` | 4px | Tight gaps (between dots, between pill text and edge) |
| `space-sm` | 6px | Pill gaps, section pill gaps, rotation bar segment gaps |
| `space-md` | 8px | Inner padding, gap between icon and text |
| `space-lg` | 12px | Suggestion card padding, compare card padding |
| `space-xl` | 14px | Card inner padding (compact cards), section body padding |
| `space-2xl` | 16px | Card outer margins, spacing between cards |
| `space-3xl` | 18px | Plan card inner padding |
| `space-4xl` | 20px | Screen horizontal padding, generous card padding |

**Screen padding:** 20px horizontal on all screens.

**Vertical rhythm between elements:**
- Between cards: 14px (10px for section cards in active session)
- Between a label and its content: 8px
- Between sections on a page: 16px
- Between tab header and first content: 14px

---

## 5. Radii

| Token | Value | Usage |
|-------|-------|-------|
| `radius-sm` | 4px | Section type pills, rating chevrons (when square-ish), small badges |
| `radius-md` | 6px | Input fields, suggestion icon, stepper buttons, pills |
| `radius-lg` | 8px | Suggestion card, buttons, plan card sections |
| `radius-xl` | 10px | Plan card, section cards, main cards |
| `radius-pill` | 24px | Instrument pills (fully rounded) |
| `radius-round` | 50% | Section pips, checkboxes rounded corners (no — checkboxes are 4px), avatars |

---

## 6. Component specifications

### Buttons

**Primary button (Start session, Finish session, Done):**
- Background: `primary` / `primary` (dark)
- Text: `text-on-primary-action` (white in both modes)
- Font: 15px / 600
- Padding: 14px vertical
- Radius: `radius-lg` (8px)
- Full width
- Hover: `primary-hover`

**Secondary text link (Practice off-plan, Edit this session):**
- Color: `text-secondary`
- Font: 13px / 400
- No background, no border
- Center-aligned below primary button

### Pills (instrument toggle)

- Inactive: transparent bg, `border-input` border, `pill-inactive-text` text
- Active: `pill-active-bg` bg, matching border, `pill-active-text` text
- Font: 12px / 500
- Padding: 5px 14px
- Radius: `radius-md` (6px)
- Gap between pills: 6px

### Section type pills

- Background and text determined by the section color system: pinned colors for Warm-up/Cool-down, pool colors for everything else (see section 2, "Section type colors")
- Font: 11px / 500
- Padding: 3px 9px
- Radius: `radius-sm` (4px)
- Gap: 6px

### Cards

**Standard card (plan card, section card, session history card):**
- Background: `card-bg`
- Border: 1px solid `border-default`
- Radius: `radius-xl` (10px)
- Padding: 18px (plan card), 0 (section cards — header and body have their own padding)

**Suggestion card:**
- Background: `amber-bg`
- Border: 1px solid `amber-border`
- Radius: `radius-lg` (8px)
- Padding: 12px 14px
- Icon: 18×18px, `radius-sm`, `amber-icon-bg` background, white text

**Coaching card (post-session):**
- Background: `coaching-bg`
- No border
- Radius: `radius-lg` (8px)
- Padding: 14px
- Text: `coaching-text`, 13px/400, line-height 1.55

**Hint card (in-session suggestion):**
- Background: `input-bg-recessed`
- Left border: 2px solid `border-input`
- Radius: `radius-md` (6px)
- Padding: 8px 10px
- Text: `text-secondary`, 11px/400, line-height 1.5

### Checkboxes

- Size: 18×18px
- Radius: 4px
- Unchecked: 1.5px `border-input` border, transparent bg
- Checked: `primary` bg, no border, white checkmark (11px/600)

### Rating chevrons

- Size: 28×28px
- Radius: `radius-md` (6px)
- Unselected: transparent bg, 1px `border-default` border, `text-tertiary` icon color
- Selected: fills per rating state table (section 2)
- Icons: ↓ (step back), — (steady), ↑ (step forward), 12px

### Time stepper

- Button size: 22×22px
- Radius: `radius-md` (6px)
- Border: 1px `border-input`
- Text (−/+): 14px, `text-secondary`
- Value: 13px/500, `text-primary`
- Min-width for value: 36px, center-aligned

### Text inputs / textareas

- Background: `input-bg` (standard) or `input-bg-recessed` (note fields within cards)
- Border: 1px `border-input`, on focus: `border-input-focus`
- Radius: `radius-md` (6px)
- Font: 13px/400
- Padding: 10px 12px
- Placeholder: `text-tertiary`, italic

### Progress bar

- Track height: 3px
- Track color: `border-default`
- Fill color: `primary`
- Radius: 2px

### Rotation bar

- Segment height: 3px
- Gap: 3px
- Empty: `border-default`
- Filled/current: `primary`
- Radius: 2px

### Bottom navigation

- Background: `page-bg`
- Top border: 1px solid `border-default`
- Padding: 12px 0 8px
- Label: `caption-small` (10px/500)
- Active: `nav-active` color
- Inactive: `nav-inactive` color
- Icons: 14px line height (placeholder — final icons TBD)

### Stat cards (session summary, Insights)

- Background: `card-bg-inset`
- No border
- Radius: `radius-lg` (8px)
- Padding: 12px
- Value: 22px/500, `text-primary`
- Label: 11px/400, `text-secondary`

### Voice input (mic button)

The primary input affordance for all text fields in the active session, session notes, and reflection prompt. Voice-first, typing-fallback.

- **Mic button:** 36×36px tap target, `Mic` Lucide icon at 20px in `text-link` color. Positioned to the right of the text field, inside the field's border or as a floating button overlapping the field's right edge.
- **Recording state:** Mic icon switches to `MicOff` or a pulsing indicator. Background becomes `primary-subtle-bg`, icon becomes `primary`. A subtle pulsing animation (opacity 0.6–1.0, 1s cycle) indicates active recording. Respect `prefers-reduced-motion`.
- **Transcription:** Text streams into the field as it's recognized. The user can edit the transcribed text afterward.
- **Fallback:** If the Web Speech API is unavailable (Firefox, some mobile browsers), hide the mic button entirely — the text field works normally. Do not show a disabled mic button (it would confuse users who don't understand why it's grayed out).
- **Error handling:** If mic permissions are denied, show a brief toast: "Microphone access is needed for voice input." Don't block the UI — the text field remains usable.

### Quick-add block

A compact inline input for adding ad hoc blocks mid-session, without opening the full block library.

- **Layout:** Single-line text input at the bottom of each section's block list, below the last exercise row. Placeholder: "Add something else..."
- **Input field:** Same styling as `TextInput` but slightly more compact — 36px height, 13px font, `input-bg-recessed` background.
- **Mic button:** Inline, same as Voice input spec above.
- **Submit:** Enter key or a submit icon (`Plus` at 16px, `text-secondary`) to the left of the mic button.
- **"Browse library" link:** Small text link (`text-link`, 11px) below or beside the quick-add input. Opens the full block library sheet.
- **On submit:** Creates a new freeform block inline — appears above the quick-add input with checkbox, name, and rating chevrons. No metadata (tempo, key, duration). The input clears and is ready for another entry.

---

## 7. Dark mode implementation

**Approach:** CSS custom properties with a `[data-theme="dark"]` selector on the root element. Default is light. User preference detected via `prefers-color-scheme` media query on first visit, then stored in settings.

```css
:root {
  --page-bg: #F7F6F3;
  --card-bg: #FFFFFF;
  --card-bg-inset: #F0EFEB;
  --text-primary: #1A1915;
  --text-secondary: #9B968C;
  --text-tertiary: #B5B0A5;
  --border-default: #E0DED8;
  --border-subtle: #F0EFEB;
  --border-input: #D4D0C8;
  --primary: #0D6B52;
  --primary-hover: #0A5C46;
  --primary-subtle-bg: #D8F3E9;
  --primary-subtle-text: #0A5C46;
  /* ... all tokens ... */
}

[data-theme="dark"] {
  --page-bg: #1C1B18;
  --card-bg: #242320;
  --card-bg-inset: #242320;
  --text-primary: #EDECE8;
  --text-secondary: #7A756B;
  --text-tertiary: #5C5850;
  --border-default: #33312B;
  --border-subtle: #2A2925;
  --border-input: #3D3A33;
  --primary: #2DB88A;
  --primary-hover: #25A57A;
  --primary-subtle-bg: #162E24;
  --primary-subtle-text: #5ECAA5;
  /* ... all tokens ... */
}
```

**Rules:**
- Never hardcode hex values in component CSS. Always use `var(--token-name)`.
- Section type pill colors are defined as a lookup (pinned colors + ordered pool), not as generic tokens. Both light and dark values are specified per color in the pool table.
- The `primary` token shifts from dark teal (#0D6B52) in light mode to brighter teal (#2DB88A) in dark mode. This is intentional — dark backgrounds need brighter accents to carry the same visual weight.

---

## 8. Branding

### Wordmark

**Typeface:** Finlandica (the official typeface of Finland, designed by Helsinki Type Studio)
**Weight:** 700 (Bold)
**Load via Google Fonts:** `Finlandica:wght@700`

Finlandica is used *only* for the wordmark — nowhere else in the app. IBM Plex Sans remains the UI typeface. This single-use keeps the wordmark distinctive without introducing a second font into the design system.

The connection is intentional: Kantelo is named after the Finnish kantele, and Finlandica was commissioned by the Finnish government. The font's design ethos — precision with a human touch, subtle inktraps, slightly compressed proportions — mirrors the product's brand personality.

| Context | Size | Letter-spacing | Color (light) | Color (dark) |
|---------|------|----------------|---------------|--------------|
| Side nav | 20px | -0.3px | `text-primary` (#1A1915) | `text-primary` (#EDECE8) |
| Sign-in / landing page | 28px | -0.3px | `text-primary` | `text-primary` |
| Mobile header | 17px | -0.3px | `text-primary` | `text-primary` |

The wordmark is always single-color (no teal accent on the K). The brand color comes through in the UI — buttons, active states, progress bars — not the wordmark itself. This keeps it clean and avoids a "logo-ified" feel that would age poorly.

### Favicon

A single Finlandica Bold "K" on a solid background.

| Context | Size | Background | Text color |
|---------|------|------------|------------|
| Favicon (browser tab) | 32×32 | `primary` (#0D6B52) | #FFFFFF |
| Apple touch icon | 180×180 | `primary` (#0D6B52) | #FFFFFF |
| PWA icon (192, 512) | 192×192, 512×512 | `primary` (#0D6B52) | #FFFFFF |

The teal background ties the favicon to the app's primary action color. At small sizes, the bold weight ensures the K remains legible.

For generating the actual icon files: render the Finlandica Bold "K" centered in the teal square at each required size. The K should be roughly 60% of the icon height, vertically and horizontally centered. Use `border-radius: 0` for favicons; PWA icons can use the platform's default mask shape.

### OG image / social card

**Low priority.** When needed: the wordmark at 28px centered on a warm stone (#F7F6F3) background, with the tagline "Practice smarter. Not just more." in IBM Plex Sans 400 below it. Dimensions: 1200×630px. No illustrations or decorative elements — just typography on the brand background.

---

## 9. Iconography

**Library:** Lucide React (`lucide-react`)
**Style:** Outline/stroke, 1.5px stroke-width throughout. No filled variants.

### Navigation icons

Used in the bottom tab nav (mobile) and side nav (desktop).

| Tab | Lucide icon | Size | Rationale |
|-----|-------------|------|-----------|
| Today | `Sun` | 20px | Warmth, daily ritual, "what's on for today." Avoids the generic calendar look. |
| Progress | `Activity` | 20px | Pulse/heartbeat line. Evokes ongoing tracking without implying a specific direction. |
| Plans | `LayoutGrid` | 20px | Structured rectangle with internal divisions. Suggests templates with sections and blocks. |
| Profile | `User` | 20px | Universally understood. The tab contains instruments and settings alongside the account. |

**Color:** `nav-inactive` when unselected, `nav-active` when selected (see color tokens, section 2).

### Inline / utility icons

Used within screens for actions, affordances, and status indicators.

| Context | Lucide icon | Size | Color | Notes |
|---------|-------------|------|-------|-------|
| Suggestion card icon | `AlertCircle` | 16px | White on `amber-icon-bg` | Inside the 18px rounded square |
| Dismiss / close | `X` | 14px | `text-tertiary` | On suggestion cards, modals |
| Expand / collapse | `ChevronDown` / `ChevronUp` | 16px | `text-tertiary` | Session history cards, collapsible sections |
| Overflow menu | `MoreHorizontal` | 16px | `text-secondary` | Block row actions (edit, delete) in template editor |
| Drag handle | `GripVertical` | 16px | `text-tertiary` | Reorder blocks and sections in template editor |
| Add / create | `Plus` | 16px | `text-secondary` | "+ Add block", "+ Add section", "+ Add instrument" |
| Checkmark | `Check` | 12px | White | Inside checked checkboxes |
| Back / navigate | `ArrowLeft` | 20px | `text-primary` | Top bar back navigation where needed |
| External link | `ExternalLink` | 14px | `text-link` | "Manage account" link to Clerk |
| Search | `Search` | 16px | `text-tertiary` | Block library search input |
| Edit | `Pencil` | 14px | `text-secondary` | Edit links on instrument cards, session history |
| Trash / delete | `Trash2` | 14px | `danger-text` | Delete actions in template editor |
| Voice input | `Mic` | 20px | `text-link` | Primary input affordance on all text fields in active session, session notes, and reflection prompt. More prominent than the text field itself. |

### Rating chevron icons

The rating chevrons use custom inline SVG arrows rather than Lucide icons, because they need to be precisely sized and centered within the 28px chevron buttons:

- Step back: `↓` arrow pointing down (12px, centered)
- Steady: `—` horizontal line (12px, centered)
- Step forward: `↑` arrow pointing up (12px, centered)

These are simple path elements, not Lucide components. See the component specification for RatingChevrons in section 6.

### Icon sizing rules

- **Nav icons:** 20px, 1.5px stroke
- **Inline icons:** 16px, 1.5px stroke (default)
- **Small inline icons:** 14px, 1.5px stroke (dismiss, external link, edit, delete)
- **Inside checkboxes:** 12px, 2px stroke (needs extra weight to read at small size)
- Never scale icons by changing stroke-width. Always use the appropriate size variant.

---

## 10. Motion & transitions

**Philosophy:** Minimal, functional motion. Transitions indicate state changes — they don't entertain.

| Property | Duration | Easing | Usage |
|----------|----------|--------|-------|
| Background color, border color | 150ms | ease-out | Button hover, pill selection, input focus |
| Opacity | 200ms | ease-out | Section completion fade, card appear/disappear |
| Transform (scale) | 100ms | ease-out | Button press (scale 0.98) |

**No animations on:**
- Page transitions (instant)
- Card expansion/collapse (instant or fast opacity, no slide)
- Rating selection (instant color change)

---

## 11. Responsive behavior

**Mobile-first.** The app is designed at 375px width and scales up.

| Breakpoint | Layout change |
|------------|---------------|
| < 640px | Single column, full-width cards, bottom tab nav |
| 640px–1024px | Wider content column (max 520px centered), bottom tab nav |
| > 1024px | Desktop layout — three-column structure (see below) |

### Desktop layout (> 1024px)

Three columns within a max-width container (~1100px, centered):

**Side nav (200px, fixed left):**
- Background: `card-bg` (white/dark card surface), right border `border-default`
- Top: "Kantelo" wordmark (18px/600, `text-primary`)
- Middle: nav links — Today, Progress, Plans. Each link is a row with an icon + label (13px/500). Active link gets `card-bg-inset` background and `primary` text color. Inactive links use `text-secondary`.
- Bottom: user profile row (avatar initials circle, name, email), anchored above the nav bottom edge with a top border separator. This replaces the mobile Profile tab — clicking opens profile/settings in the main content area.
- Padding: 24px vertical, 8px horizontal for nav links, 20px horizontal for logo and profile.

**Main content (flex: 1, max-width 520px):**
- Centered within its flex area with 32px top padding and 40px horizontal padding.
- Contains the same content as the mobile layout — no restructuring needed.
- The 520px max-width keeps content readable on wide screens. Text lines stay under ~75 characters.

**Secondary panel (260px, right side, optional):**
- Left border `border-default`, 32px left padding.
- Contains contextual at-a-glance information that supplements the main content:
  - **Today tab:** Current streak card, mini practice heatmap (current month), recent sessions list.
  - **Progress tab:** Pattern-level suggestion card (if on History sub-tab), or rating trend summary (if on Insights sub-tab).
  - **Plans tab:** Quick stats for the selected template (sessions in rotation, total estimated time, last practiced date).
- Each item is a standard `card-bg` card with `border-default` border, `radius-xl`, 16px padding.
- The secondary panel collapses (hidden) at the 640–1024px breakpoint. Its content is not essential — it duplicates information available elsewhere in the app.

**Desktop nav → mobile nav mapping:**
- Side nav replaces bottom tab nav entirely at the desktop breakpoint.
- Profile moves from a bottom nav tab to the side nav footer. Profile/settings pages render in the main content area.
- The bottom tab nav is hidden via `display: none` at > 1024px.

---

## 12. Accessibility

- **Color is never the only indicator.** Ratings use directional shapes (↓, —, ↑) alongside color. Section types use text labels alongside colored pills.
- **Contrast ratios:** All text/background combinations meet WCAG AA (4.5:1 for body text, 3:1 for large text). The warm stone background was specifically chosen to maintain sufficient contrast with `text-primary` in both modes.
- **Focus indicators:** 2px `primary` outline with 2px offset on all interactive elements. Visible in both light and dark modes.
- **Touch targets:** Minimum 44×44px for all tappable elements (buttons, checkboxes, pills, chevrons). The 28px chevron buttons should have 44px tap targets via padding.
- **Reduced motion:** Respect `prefers-reduced-motion` — disable all transitions when set.
