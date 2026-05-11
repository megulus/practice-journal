import type { SectionType } from './types'

/**
 * Section color assignment.
 *
 * Per docs/kantelo-design-tokens.md §2, section colors come from two
 * sources:
 *   - **Pinned**: Warm-up and Cool-down always use the same color.
 *   - **Pool**: every other section type rotates through an 8-color
 *     pool by `display_order` within a template session. The first
 *     non-pinned section gets blue, the second purple, etc., wrapping
 *     after 8.
 *
 * Each color references CSS custom properties defined in tokens.css so
 * light/dark mode swaps automatically. Components apply via inline
 * `style={{ backgroundColor: color.pillBg, color: color.pillText }}`.
 */

export type SectionColorName =
  | 'warmup'
  | 'cooldown'
  | 'blue'
  | 'purple'
  | 'amber'
  | 'pink'
  | 'indigo'
  | 'copper'
  | 'slate_blue'
  | 'olive'

export interface SectionColor {
  name: SectionColorName
  pillBg: string
  pillText: string
  pip: string
}

const SECTION_COLORS: Record<SectionColorName, SectionColor> = {
  warmup: {
    name: 'warmup',
    pillBg: 'var(--section-warmup-pill-bg)',
    pillText: 'var(--section-warmup-pill-text)',
    pip: 'var(--section-warmup-pip)',
  },
  cooldown: {
    name: 'cooldown',
    pillBg: 'var(--section-cooldown-pill-bg)',
    pillText: 'var(--section-cooldown-pill-text)',
    pip: 'var(--section-cooldown-pip)',
  },
  blue: {
    name: 'blue',
    pillBg: 'var(--section-blue-pill-bg)',
    pillText: 'var(--section-blue-pill-text)',
    pip: 'var(--section-blue-pip)',
  },
  purple: {
    name: 'purple',
    pillBg: 'var(--section-purple-pill-bg)',
    pillText: 'var(--section-purple-pill-text)',
    pip: 'var(--section-purple-pip)',
  },
  amber: {
    name: 'amber',
    pillBg: 'var(--section-amber-pill-bg)',
    pillText: 'var(--section-amber-pill-text)',
    pip: 'var(--section-amber-pip)',
  },
  pink: {
    name: 'pink',
    pillBg: 'var(--section-pink-pill-bg)',
    pillText: 'var(--section-pink-pill-text)',
    pip: 'var(--section-pink-pip)',
  },
  indigo: {
    name: 'indigo',
    pillBg: 'var(--section-indigo-pill-bg)',
    pillText: 'var(--section-indigo-pill-text)',
    pip: 'var(--section-indigo-pip)',
  },
  copper: {
    name: 'copper',
    pillBg: 'var(--section-copper-pill-bg)',
    pillText: 'var(--section-copper-pill-text)',
    pip: 'var(--section-copper-pip)',
  },
  slate_blue: {
    name: 'slate_blue',
    pillBg: 'var(--section-slate-blue-pill-bg)',
    pillText: 'var(--section-slate-blue-pill-text)',
    pip: 'var(--section-slate-blue-pip)',
  },
  olive: {
    name: 'olive',
    pillBg: 'var(--section-olive-pill-bg)',
    pillText: 'var(--section-olive-pill-text)',
    pip: 'var(--section-olive-pip)',
  },
}

/** Ordered pool — assigned to non-pinned sections by display_order. */
export const SECTION_COLOR_POOL: SectionColorName[] = [
  'blue',
  'purple',
  'amber',
  'pink',
  'indigo',
  'copper',
  'slate_blue',
  'olive',
]

/**
 * Resolve the section color for a section in a template session.
 *
 * @param sectionType - The section type from the backend.
 * @param nonPinnedIndex - 0-indexed position among non-pinned sections
 *   in the session. Callers iterating over sections should track this
 *   themselves — warm-up and cool-down are pinned and don't consume a
 *   pool slot, so they don't increment the index.
 */
export function getSectionColor(
  sectionType: SectionType,
  nonPinnedIndex: number,
): SectionColor {
  if (sectionType === 'warmup') return SECTION_COLORS.warmup
  if (sectionType === 'cooldown') return SECTION_COLORS.cooldown
  const poolName =
    SECTION_COLOR_POOL[nonPinnedIndex % SECTION_COLOR_POOL.length]
  return SECTION_COLORS[poolName]
}

export const SECTION_COLORS_BY_NAME = SECTION_COLORS
