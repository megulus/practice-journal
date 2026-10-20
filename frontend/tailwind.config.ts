import type { Config } from 'tailwindcss'
import plugin from 'tailwindcss/plugin'
import { cssVariables, tailwindTheme } from '@kantelo/core/tokens'

/**
 * Kantelo Tailwind config.
 *
 * Design tokens come from @kantelo/core/tokens (packages/core/src/tokens.ts),
 * the one place their values are written. From it this config derives both
 * halves of the web's token layer:
 *   - the CSS custom properties, emitted as base styles by the plugin below
 *     (light on `:root`, dark under `[data-theme="dark"]`);
 *   - the color, spacing and radius utilities, which reference those
 *     properties. Utility names match the design tokens doc 1:1, which means
 *     some doubled prefixes (`bg-page-bg`, `text-text-primary`,
 *     `border-border-default`) — chosen so the doc remains the unambiguous
 *     source of truth.
 *
 * Canonical token names and values: docs/kantelo-design-tokens.md
 */
const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      keyframes: {
        // Recording indicator for VoiceInput — opacity 0.6–1.0, 1s cycle
        // (design-tokens §6). Gated with motion-safe: at the usage site.
        'voice-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
      animation: {
        'voice-pulse': 'voice-pulse 1s ease-in-out infinite',
      },
      ...tailwindTheme,
      fontFamily: {
        sans: ['var(--font-ibm-plex-sans)', 'system-ui', 'sans-serif'],
        wordmark: ['var(--font-finlandica)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [
    // `data-theme="light"` lets a subtree force light inside a dark page (the
    // /preview route shows both modes side by side). Dark must come second:
    // the selectors tie on specificity, so source order decides.
    plugin(({ addBase }) => {
      addBase({
        ':root, [data-theme="light"]': cssVariables('light'),
        '[data-theme="dark"]': cssVariables('dark'),
      })
    }),
  ],
}
export default config
