'use client'

import { usePathname } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import BottomNav from './BottomNav'

/** Pages where the bottom nav should NOT appear. */
const NO_NAV_ROUTES = ['/sign-in', '/sign-up']

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { isSignedIn } = useUser()

  const showNav =
    isSignedIn && !NO_NAV_ROUTES.some((r) => pathname?.startsWith(r))

  return (
    <div className={showNav ? 'pb-16' : ''}>
      {children}
      {showNav && <BottomNav />}
    </div>
  )
}
