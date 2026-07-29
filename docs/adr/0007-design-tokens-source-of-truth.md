# ADR-0007 — Design tokens as the styling source of truth

- **Status:** Accepted
- **Date:** Reconstructed 2026-07-28 (original decision predates this record)

## Context

Kantelo has a specific visual identity ("Clean Edge + Warm Stone") with
first-class light and dark modes. Styling needs to be consistent, themeable, and
resistant to ad-hoc drift as screens are built.

## Decision

Treat **design tokens as the source of truth**, with a defined pipeline:
`docs/kantelo-design-tokens.md` (the authority) → `frontend/src/lib/tokens.css`
(CSS custom properties, `:root` light + `[data-theme="dark"]` dark) → exposed as
Tailwind utilities in `tailwind.config.ts`. Utility names mirror token names
verbatim, including doubled prefixes like `text-text-primary`, `bg-card-bg`,
`border-border-default`.

## Rationale

- One authoritative set of values; components reference tokens, never raw hex.
- Light/dark theming is a CSS-variable swap on `[data-theme]`, not per-component
  branching.
- The verbatim (even "ugly") utility names keep the mapping between doc and code
  unambiguous — the design doc stays the source of truth.
- Section-type colors are applied via `getSectionColor()` + inline style (not
  Tailwind utilities) because they encode an assignment rule (pinned warm-up/
  cool-down + an 8-color pool by display order), not a static palette.

## Alternatives considered

- **Ad-hoc Tailwind classes / a CSS-in-JS theme object** — easier short-term,
  but drifts and duplicates the palette. *(Reconstructed.)*
- **Prettier semantic utility names** (e.g. `text-primary` instead of
  `text-text-primary`) — rejected to preserve the exact doc↔code mapping.

## Consequences

- Adding/renaming a token means touching the doc, `tokens.css`, and the Tailwind
  config together (keep the contract doc current — see the docs-hygiene rule in
  CLAUDE.md).
- This system is what made the Phase-0 "retone" a systematic pass rather than
  ad-hoc restyling; legacy indigo classes were removed screen by screen.
- A dev-only `/preview` route renders every primitive in both modes side by side.
