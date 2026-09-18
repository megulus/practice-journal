/**
 * Build-time config. Phase A finding: `NEXT_PUBLIC_*` values are inlined into
 * the bundle at `next build`, and Capacitor ships that bundle inside the
 * binary — so a Capacitor build is pinned to one environment's keys and API
 * URL at build time, not at boot.
 */
export const CLERK_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? ''
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

/**
 * Phase B escape hatch. `@clerk/types` on ClerkOptions.standardBrowser:
 * "By default, ClerkJS is loaded with the assumption that cookies can be set
 * (browser setup). On native platforms this value must be set to `false`."
 *
 * Set NEXT_PUBLIC_CLERK_STANDARD_BROWSER=false and rebuild if the session
 * turns out not to survive on `capacitor://localhost` because cookies don't
 * stick there.
 */
export const CLERK_STANDARD_BROWSER =
  process.env.NEXT_PUBLIC_CLERK_STANDARD_BROWSER !== 'false'
