import type { Config } from 'tailwindcss'

// Tailwind is here only so the spike matches Kantelo's toolchain; the harness
// is deliberately unstyled.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
}
export default config
