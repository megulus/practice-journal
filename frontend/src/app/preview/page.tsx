import { redirect } from 'next/navigation'
import PreviewContent from './PreviewContent'

/**
 * Dev-only primitive preview. Auto-redirects to /today in production so
 * the route is never reachable on the live app — clients won't even ship
 * the PreviewContent bundle because this is a server component and the
 * redirect runs before the client component is rendered.
 */
export default function PreviewPage() {
  if (process.env.NODE_ENV === 'production') {
    redirect('/today')
  }
  return <PreviewContent />
}
