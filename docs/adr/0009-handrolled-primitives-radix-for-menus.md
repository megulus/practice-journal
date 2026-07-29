# ADR-0009 — Hand-rolled UI primitives; a library only for hard a11y

- **Status:** Accepted
- **Date:** Reconstructed 2026-07-28 (original decision predates this record)

## Context

The design system needs a set of primitives (Button, Card, Pill, Checkbox,
TimeStepper, RatingChevrons, inputs, etc.). The choice is between adopting a
component library wholesale or building primitives against the token system.

## Decision

**Hand-roll the primitives** in `components/ui/` against the design tokens
(ADR-0007). Reach for a library (Radix) **only** where the accessibility surface
is genuinely hard to get right — the first such checkpoint being the overflow
**menu** (adopted `@radix-ui/react-dropdown-menu`).

## Rationale

- Most primitives are simple and benefit from full control over markup, styling,
  and token wiring; a library would fight the token system and add weight.
- The menu is different: focus management, keyboard navigation, portalling, and
  ARIA are easy to get subtly wrong. That's where a battle-tested primitive earns
  its dependency.
- Keeps the dependency footprint small and intentional rather than pulling a
  whole design-system library for a handful of behaviors.

## Alternatives considered

- **Full component library (MUI, Chakra, shadcn/Radix everywhere)** — faster to
  assemble, but heavier and harder to bend to the exact token system and visual
  identity. *(Reconstructed.)*
- **Hand-roll everything, including the menu** — rejected once the menu's a11y
  complexity became the clear line worth crossing.

## Consequences

- A clear, defensible rule for future components: hand-roll by default; adopt a
  library when the a11y/interaction complexity (focus traps, dialogs, comboboxes)
  justifies it.
- Radix is a sanctioned dependency for that category; adding a Radix package
  requires the container-install + restart step (see ADR-0008).
