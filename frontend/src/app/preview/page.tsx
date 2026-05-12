import { redirect } from 'next/navigation'
import PreviewContent from './PreviewContent'

/**
 * Dev-only primitive preview. Auto-redirects to /today in production so
 * the route is never reachable on the live app.
 *
 * Note: the PreviewContent client chunk is still emitted in production
 * builds because Next sees the import boundary at module load. The route
 * never serves it (redirect short-circuits at request time), so the
 * bundle just sits unused. Splitting it out via dynamic() would avoid
 * emission but adds complexity for ~3.5 kB — not worth it for a dev
 * tool that doesn't ship to users.
 */
export default function PreviewPage() {
  if (process.env.NODE_ENV === 'production') {
    redirect('/today')
  }
  return <PreviewContent />
}
