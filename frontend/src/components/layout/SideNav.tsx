'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { LogOut, User } from 'lucide-react'
import { Menu } from '@/components/ui'
import { useSignOut } from '@/hooks/useSignOut'
import { primaryNavItems } from './navItems'
import { isActivePath } from './isActivePath'
import { getUserDisplay } from './userDisplay'

/**
 * Desktop (`lg`+) side nav: wordmark, primary nav links, and a profile footer
 * that opens a menu (Profile + Sign out). Hidden below `lg`, where
 * {@link BottomNav} + {@link MobileHeader} take over.
 */
export default function SideNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useUser()
  const signOut = useSignOut()
  const { name, email, initials } = getUserDisplay(user)

  return (
    <aside className="sticky top-0 hidden h-screen w-[200px] shrink-0 flex-col border-r border-border-default bg-card-bg lg:flex">
      {/* Wordmark */}
      <div className="px-5 py-6">
        <span
          className="font-wordmark text-text-primary"
          style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.3px' }}
        >
          Kantelo
        </span>
      </div>

      {/* Nav links */}
      <nav aria-label="Primary" className="flex-1 space-y-0.5 px-2">
        {primaryNavItems.map(({ label, href, icon: Icon }) => {
          const active = isActivePath(pathname, href)
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${
                active
                  ? 'bg-card-bg-inset text-nav-active'
                  : 'text-text-secondary hover:bg-card-bg-inset'
              }`}
            >
              <Icon size={20} strokeWidth={1.5} aria-hidden />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Profile footer — opens a menu (Profile + Sign out) */}
      <Menu
        align="start"
        trigger={
          <button
            type="button"
            className="flex w-full items-center gap-3 border-t border-border-default px-5 py-4 text-left transition-colors hover:bg-card-bg-inset focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
          >
            <span
              aria-hidden
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-round bg-card-bg-inset text-xs font-semibold text-text-secondary"
            >
              {initials}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium text-text-primary">
                {name}
              </span>
              {email && (
                <span className="block truncate text-[11px] text-text-tertiary">
                  {email}
                </span>
              )}
            </span>
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
    </aside>
  )
}
