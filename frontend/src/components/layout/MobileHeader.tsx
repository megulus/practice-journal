'use client'

import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { getUserDisplay } from './userDisplay'

/**
 * Mobile / tablet top header: Kantelo wordmark + avatar linking to the profile
 * page. Hidden at the desktop breakpoint (`lg`), where {@link SideNav} carries
 * the wordmark and profile access.
 */
export default function MobileHeader() {
  const { user } = useUser()
  const { name, initials } = getUserDisplay(user)

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border-default bg-card-bg px-4 py-3 lg:hidden">
      <span
        className="font-wordmark text-text-primary"
        style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.3px' }}
      >
        Kantelo
      </span>
      <Link
        href="/profile"
        aria-label={`${name} — profile`}
        className="flex h-8 w-8 items-center justify-center rounded-round bg-card-bg-inset text-xs font-semibold text-text-secondary"
      >
        {initials}
      </Link>
    </header>
  )
}
