'use client'

import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { LogOut, User } from 'lucide-react'
import { Menu } from '@/components/ui'
import { useSignOut } from '@/hooks/useSignOut'
import { getUserDisplay } from './userDisplay'

/**
 * Mobile / tablet top header: Kantelo wordmark + an avatar that opens a menu
 * (Profile + Sign out). Hidden at the desktop breakpoint (`lg`), where
 * {@link SideNav} carries the wordmark and profile access.
 */
export default function MobileHeader() {
  const router = useRouter()
  const { user } = useUser()
  const signOut = useSignOut()
  const { name, initials } = getUserDisplay(user)

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border-default bg-card-bg px-4 py-3 lg:hidden">
      <span
        className="font-wordmark text-text-primary"
        style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.3px' }}
      >
        Kantelo
      </span>
      <Menu
        align="end"
        trigger={
          <button
            type="button"
            aria-label={`${name} — menu`}
            className="flex h-8 w-8 items-center justify-center rounded-round bg-card-bg-inset text-xs font-semibold text-text-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {initials}
          </button>
        }
        items={[
          {
            label: 'Profile',
            icon: <User size={14} />,
            onSelect: () => router.push('/profile'),
          },
          {
            label: 'Sign out',
            icon: <LogOut size={14} />,
            onSelect: signOut,
          },
        ]}
      />
    </header>
  )
}
