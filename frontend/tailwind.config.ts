import type { Config } from 'tailwindcss'

/**
 * Kantelo Tailwind config.
 *
 * Colors, spacing, and radii consume CSS custom properties defined in
 * src/lib/tokens.css. Utility names match the design tokens doc 1:1,
 * which means some doubled prefixes (`bg-page-bg`, `text-text-primary`,
 * `border-border-default`) — chosen so the doc remains the unambiguous
 * source of truth.
 *
 * Source of truth for token names and values:
 *   docs/kantelo-design-tokens.md
 */
const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Surfaces
        'page-bg': 'var(--page-bg)',
        'card-bg': 'var(--card-bg)',
        'card-bg-inset': 'var(--card-bg-inset)',
        'input-bg': 'var(--input-bg)',
        'input-bg-recessed': 'var(--input-bg-recessed)',

        // Text
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-tertiary': 'var(--text-tertiary)',
        'text-on-primary-action': 'var(--text-on-primary-action)',
        'text-link': 'var(--text-link)',

        // Borders
        'border-default': 'var(--border-default)',
        'border-subtle': 'var(--border-subtle)',
        'border-input': 'var(--border-input)',
        'border-input-focus': 'var(--border-input-focus)',

        // Primary (teal action)
        primary: 'var(--primary)',
        'primary-hover': 'var(--primary-hover)',
        'primary-subtle-bg': 'var(--primary-subtle-bg)',
        'primary-subtle-text': 'var(--primary-subtle-text)',
        'primary-subtle-border': 'var(--primary-subtle-border)',

        // Amber (coaching / suggestions / step back)
        'amber-bg': 'var(--amber-bg)',
        'amber-border': 'var(--amber-border)',
        'amber-icon-bg': 'var(--amber-icon-bg)',
        'amber-text': 'var(--amber-text)',
        'amber-text-muted': 'var(--amber-text-muted)',
        'amber-subtle-bg': 'var(--amber-subtle-bg)',
        'amber-subtle-text': 'var(--amber-subtle-text)',
        'amber-subtle-border': 'var(--amber-subtle-border)',

        // Rating states
        'rating-back-bg': 'var(--rating-back-bg)',
        'rating-back-border': 'var(--rating-back-border)',
        'rating-back-icon': 'var(--rating-back-icon)',
        'rating-steady-bg': 'var(--rating-steady-bg)',
        'rating-steady-border': 'var(--rating-steady-border)',
        'rating-steady-icon': 'var(--rating-steady-icon)',
        'rating-forward-bg': 'var(--rating-forward-bg)',
        'rating-forward-border': 'var(--rating-forward-border)',
        'rating-forward-icon': 'var(--rating-forward-icon)',
        'rating-unselected-bg': 'var(--rating-unselected-bg)',
        'rating-unselected-border': 'var(--rating-unselected-border)',
        'rating-unselected-icon': 'var(--rating-unselected-icon)',

        // Pills (active/inactive)
        'pill-active-bg': 'var(--pill-active-bg)',
        'pill-active-text': 'var(--pill-active-text)',
        'pill-inactive-border': 'var(--pill-inactive-border)',
        'pill-inactive-text': 'var(--pill-inactive-text)',

        // Nav
        'nav-active': 'var(--nav-active)',
        'nav-inactive': 'var(--nav-inactive)',

        // Coaching card
        'coaching-bg': 'var(--coaching-bg)',
        'coaching-text': 'var(--coaching-text)',

        // Heatmap
        'heatmap-empty': 'var(--heatmap-empty)',
        'heatmap-light': 'var(--heatmap-light)',
        'heatmap-medium': 'var(--heatmap-medium)',
        'heatmap-dark': 'var(--heatmap-dark)',
        'heatmap-full': 'var(--heatmap-full)',

        // Danger
        'danger-text': 'var(--danger-text)',
      },
      spacing: {
        xs: 'var(--space-xs)',
        sm: 'var(--space-sm)',
        md: 'var(--space-md)',
        lg: 'var(--space-lg)',
        xl: 'var(--space-xl)',
        '2xl': 'var(--space-2xl)',
        '3xl': 'var(--space-3xl)',
        '4xl': 'var(--space-4xl)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        pill: 'var(--radius-pill)',
        round: 'var(--radius-round)',
      },
      fontFamily: {
        sans: ['var(--font-ibm-plex-sans)', 'system-ui', 'sans-serif'],
        wordmark: ['var(--font-finlandica)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
