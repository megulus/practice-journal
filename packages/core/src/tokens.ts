/**
 * Kantelo design tokens: the single source of their values (#335).
 *
 * docs/kantelo-design-tokens.md stays canonical for what the values are
 * (ADR-0007); this file is how they're represented in code. Nothing restates
 * them: the web's CSS custom properties (`cssVariables`) and Tailwind theme
 * (`tailwindTheme`) are both derived from these objects in
 * frontend/tailwind.config.ts, and React Native reads the same objects.
 *
 * Light is the default (`:root`); dark applies under `[data-theme="dark"]`.
 * Utilities reference the custom properties rather than the raw values, so
 * switching mode is a variable swap, not a second set of classes.
 */

export type ThemeMode = 'light' | 'dark'

/** Light-mode colors, keyed by token name (CSS custom property `--<name>`). */
const light = {
  // Surfaces
  'page-bg': '#F7F6F3',
  'card-bg': '#FFFFFF',
  'card-bg-inset': '#F0EFEB',
  'input-bg': '#FFFFFF',
  'input-bg-recessed': '#F7F6F3',

  // Text
  'text-primary': '#1A1915',
  'text-secondary': '#9B968C',
  'text-tertiary': '#B5B0A5',
  'text-on-primary-action': '#FFFFFF',
  'text-link': '#0D6B52',

  // Borders
  'border-default': '#E0DED8',
  'border-subtle': '#F0EFEB',
  'border-input': '#D4D0C8',
  'border-input-focus': '#0D6B52',

  // Primary (teal) — actions, positive states
  'primary': '#0D6B52',
  'primary-hover': '#0A5C46',
  'primary-subtle-bg': '#D8F3E9',
  'primary-subtle-text': '#0A5C46',
  'primary-subtle-border': '#5ECAA5',

  // Amber — coaching, suggestions, "step back"
  'amber-bg': '#FFFBF5',
  'amber-border': '#EEDCBE',
  'amber-icon-bg': '#D98A2B',
  'amber-text': '#6E5020',
  'amber-text-muted': '#C49E5C',
  'amber-subtle-bg': '#FAEEDA',
  'amber-subtle-text': '#9A7020',
  'amber-subtle-border': '#D4A44A',

  // Section type — pinned colors (Warm-up, Cool-down)
  'section-warmup-pill-bg': '#FEF0EA',
  'section-warmup-pill-text': '#A84820',
  'section-warmup-pip': '#D85A30',
  'section-cooldown-pill-bg': '#D8F3E9',
  'section-cooldown-pill-text': '#0A5C46',
  'section-cooldown-pip': '#1D9E75',

  // Section type — color pool (assigned by display_order)
  'section-blue-pill-bg': '#E6F0FD',
  'section-blue-pill-text': '#1A5C9E',
  'section-blue-pip': '#378ADD',
  'section-purple-pill-bg': '#EEEDFD',
  'section-purple-pill-text': '#4842A6',
  'section-purple-pip': '#7F77DD',
  'section-amber-pill-bg': '#FFF4E5',
  'section-amber-pill-text': '#8A5E15',
  'section-amber-pip': '#D98A2B',
  'section-pink-pill-bg': '#FBEAF0',
  'section-pink-pill-text': '#993556',
  'section-pink-pip': '#D4537E',
  'section-indigo-pill-bg': '#EAECFA',
  'section-indigo-pill-text': '#3444A0',
  'section-indigo-pip': '#4A5BC7',
  'section-copper-pill-bg': '#F5EBE5',
  'section-copper-pill-text': '#7A4530',
  'section-copper-pip': '#B0694E',
  'section-slate-blue-pill-bg': '#EBF0F5',
  'section-slate-blue-pill-text': '#3E6080',
  'section-slate-blue-pip': '#5A7FA0',
  'section-olive-pill-bg': '#EFF3E5',
  'section-olive-pill-text': '#4A6520',
  'section-olive-pip': '#6B8C42',

  // Rating states — Step back
  'rating-back-bg': '#FAEEDA',
  'rating-back-border': '#D4A44A',
  'rating-back-icon': '#9A7020',
  // Rating states — Steady
  'rating-steady-bg': '#F0EFEB',
  'rating-steady-border': '#D4D0C8',
  'rating-steady-icon': '#9B968C',
  // Rating states — Step forward
  'rating-forward-bg': '#D8F3E9',
  'rating-forward-border': '#5ECAA5',
  'rating-forward-icon': '#0A5C46',
  // Rating states — Unselected
  'rating-unselected-bg': 'transparent',
  'rating-unselected-border': '#E0DED8',
  'rating-unselected-icon': '#B5B0A5',

  // Active / selected states
  'pill-active-bg': '#1A1915',
  'pill-active-text': '#F7F6F3',
  'pill-inactive-border': '#D4D0C8',
  'pill-inactive-text': '#7A756B',
  'nav-active': '#0D6B52',
  'nav-inactive': '#B5B0A5',

  // Coaching card (post-session)
  'coaching-bg': '#D8F3E9',
  'coaching-text': '#085041',

  // Heatmap (Insights)
  'heatmap-empty': '#F0EFEB',
  'heatmap-light': '#9FE1CB',
  'heatmap-medium': '#5DCAA5',
  'heatmap-dark': '#1D9E75',
  'heatmap-full': '#0F6E56',

  // Danger / destructive
  'danger-text': '#A32D2D',
}

export type ColorToken = keyof typeof light

/** Dark-mode colors. Typed against light so neither mode can miss a token. */
const dark: Record<ColorToken, string> = {
  // Surfaces
  'page-bg': '#1C1B18',
  'card-bg': '#242320',
  'card-bg-inset': '#242320',
  'input-bg': '#242320',
  'input-bg-recessed': '#242320',

  // Text
  'text-primary': '#EDECE8',
  'text-secondary': '#7A756B',
  'text-tertiary': '#5C5850',
  'text-on-primary-action': '#FFFFFF',
  'text-link': '#2DB88A',

  // Borders
  'border-default': '#33312B',
  'border-subtle': '#2A2925',
  'border-input': '#3D3A33',
  'border-input-focus': '#2DB88A',

  // Primary (teal)
  'primary': '#2DB88A',
  'primary-hover': '#25A57A',
  'primary-subtle-bg': '#162E24',
  'primary-subtle-text': '#5ECAA5',
  'primary-subtle-border': '#2A7A5C',

  // Amber
  'amber-bg': '#2A2318',
  'amber-border': '#4A3D28',
  'amber-icon-bg': '#D98A2B',
  'amber-text': '#D4A85C',
  'amber-text-muted': '#8A7040',
  'amber-subtle-bg': '#332A18',
  'amber-subtle-text': '#D4A85C',
  'amber-subtle-border': '#6B5528',

  // Section type — pinned colors
  'section-warmup-pill-bg': '#33221A',
  'section-warmup-pill-text': '#E8845A',
  'section-warmup-pip': '#D85A30',
  'section-cooldown-pill-bg': '#162E24',
  'section-cooldown-pill-text': '#5ECAA5',
  'section-cooldown-pip': '#1D9E75',

  // Section type — color pool
  'section-blue-pill-bg': '#1A2533',
  'section-blue-pill-text': '#6AACEC',
  'section-blue-pip': '#378ADD',
  'section-purple-pill-bg': '#22203A',
  'section-purple-pill-text': '#9B94E0',
  'section-purple-pip': '#7F77DD',
  'section-amber-pill-bg': '#332A18',
  'section-amber-pill-text': '#E8A840',
  'section-amber-pip': '#D98A2B',
  'section-pink-pill-bg': '#2E1A22',
  'section-pink-pill-text': '#E07A9E',
  'section-pink-pip': '#D4537E',
  'section-indigo-pill-bg': '#1E2040',
  'section-indigo-pill-text': '#8B9AE0',
  'section-indigo-pip': '#4A5BC7',
  'section-copper-pill-bg': '#302018',
  'section-copper-pill-text': '#D4906A',
  'section-copper-pip': '#B0694E',
  'section-slate-blue-pill-bg': '#1A2530',
  'section-slate-blue-pill-text': '#8AB4D4',
  'section-slate-blue-pip': '#5A7FA0',
  'section-olive-pill-bg': '#222818',
  'section-olive-pill-text': '#A4C468',
  'section-olive-pip': '#6B8C42',

  // Rating states
  'rating-back-bg': '#332A18',
  'rating-back-border': '#6B5528',
  'rating-back-icon': '#D4A85C',
  'rating-steady-bg': '#2A2925',
  'rating-steady-border': '#3D3A33',
  'rating-steady-icon': '#7A756B',
  'rating-forward-bg': '#162E24',
  'rating-forward-border': '#2A7A5C',
  'rating-forward-icon': '#5ECAA5',
  'rating-unselected-bg': 'transparent',
  'rating-unselected-border': '#33312B',
  'rating-unselected-icon': '#5C5850',

  // Active / selected states
  'pill-active-bg': '#EDECE8',
  'pill-active-text': '#1C1B18',
  'pill-inactive-border': '#3D3A33',
  'pill-inactive-text': '#9B968C',
  'nav-active': '#2DB88A',
  'nav-inactive': '#5C5850',

  // Coaching card
  'coaching-bg': '#162E24',
  'coaching-text': '#9FE1CB',

  // Heatmap
  'heatmap-empty': '#2A2925',
  'heatmap-light': '#1A5040',
  'heatmap-medium': '#0F6E56',
  'heatmap-dark': '#2DB88A',
  'heatmap-full': '#5ECAA5',

  // Danger
  'danger-text': '#F09595',
}

export const colors: Record<ThemeMode, Record<ColorToken, string>> = {
  light,
  dark,
}

/** Spacing scale (`--space-<key>`). The same in both modes. */
export const spacing = {
  xs: '4px',
  sm: '6px',
  md: '8px',
  lg: '12px',
  xl: '14px',
  '2xl': '16px',
  '3xl': '18px',
  '4xl': '20px',
}

/** Corner radii (`--radius-<key>`). The same in both modes. */
export const radii = {
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '10px',
  pill: '24px',
  round: '50%',
}

/**
 * The custom properties for one mode, e.g. `{ '--page-bg': '#F7F6F3', … }`.
 * Spacing and radii don't vary by mode, so only light (the `:root` default)
 * declares them.
 */
export function cssVariables(mode: ThemeMode): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const [name, value] of Object.entries(colors[mode])) {
    vars[`--${name}`] = value
  }
  if (mode === 'light') {
    for (const [key, value] of Object.entries(spacing)) {
      vars[`--space-${key}`] = value
    }
    for (const [key, value] of Object.entries(radii)) {
      vars[`--radius-${key}`] = value
    }
  }
  return vars
}

function varRefs(keys: string[], prefix = ''): Record<string, string> {
  return Object.fromEntries(keys.map((key) => [key, `var(--${prefix}${key})`]))
}

/**
 * Tailwind theme entries, named after the tokens verbatim (`bg-page-bg`,
 * `text-text-primary`, `p-md`, `rounded-xl`). Section colors are left out:
 * they're applied through `getSectionColor()` because they follow an
 * assignment rule, not a static palette (ADR-0007).
 */
export const tailwindTheme = {
  colors: varRefs(
    Object.keys(light).filter((name) => !name.startsWith('section-')),
  ),
  spacing: varRefs(Object.keys(spacing), 'space-'),
  borderRadius: varRefs(Object.keys(radii), 'radius-'),
}
