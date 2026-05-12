import { redirect } from 'next/navigation'
import PreviewContent from './PreviewContent'

/**
 * Dev / staging primitive preview. Redirects to /today on production
 * deploys so the route is never reachable on the live app.
 *
 * Gating:
 *   - Local `npm run dev` → NODE_ENV=development → shown.
 *   - Production build with NEXT_PUBLIC_PREVIEW_ENABLED=1 (e.g., current
 *     Railway env used for dev/staging testing) → shown.
 *   - Production build without that env var → redirected.
 *
 * The default behavior is secure: future real production environments
 * simply omit the override and the redirect kicks in. No code change
 * needed when prod splits off from the current Railway service.
 *
 * Note: the PreviewContent client chunk is still emitted in production
 * builds because Next sees the import boundary at module load. The
 * route never serves it (redirect short-circuits at request time), so
 * the bundle just sits unused. Splitting it out via dynamic() would
 * avoid emission but adds complexity for ~3.5 kB — not worth it for a
 * dev tool that doesn't ship to end users.
 */
export default function PreviewPage() {
  const isProd = process.env.NODE_ENV === 'production'
  const overrideEnabled = process.env.NEXT_PUBLIC_PREVIEW_ENABLED === '1'
  if (isProd && !overrideEnabled) {
    redirect('/today')
  }
  return <PreviewContent />
}
