import { describe, it, expect } from 'vitest'
import { SECTION_COLORS_BY_NAME } from './section-colors'
import { colors, cssVariables, tailwindTheme } from './tokens'

// Every `var(--x)` in these must name a property `:root` declares, or the
// style silently falls back to the browser default.
const declared = new Set(Object.keys(cssVariables('light')))
const referencedVars = (values: string[]) =>
  values.map((v) => /^var\((--[\w-]+)\)$/.exec(v)?.[1] ?? v)

describe('tokens', () => {
  it('gives both modes the same colors', () => {
    expect(Object.keys(colors.dark)).toEqual(Object.keys(colors.light))
  })

  it('declares spacing and radii once, on the light default', () => {
    const darkOnly = Object.keys(cssVariables('dark'))
    expect(darkOnly.filter((v) => /^--(space|radius)-/.test(v))).toEqual([])
    expect(declared).toContain('--space-2xl')
    expect(declared).toContain('--radius-round')
  })

  it('points every Tailwind utility at a declared property', () => {
    const refs = referencedVars([
      ...Object.values(tailwindTheme.colors),
      ...Object.values(tailwindTheme.spacing),
      ...Object.values(tailwindTheme.borderRadius),
    ])
    expect(refs.filter((r) => !declared.has(r))).toEqual([])
  })

  it('declares every property the section colors read', () => {
    const refs = referencedVars(
      Object.values(SECTION_COLORS_BY_NAME).flatMap((c) => [c.pillBg, c.pillText, c.pip]),
    )
    expect(refs.filter((r) => !declared.has(r))).toEqual([])
  })

  it('keeps section colors out of the utilities', () => {
    expect(Object.keys(tailwindTheme.colors).filter((n) => n.startsWith('section-'))).toEqual([])
    expect(tailwindTheme.colors['page-bg']).toBe('var(--page-bg)')
  })
})
