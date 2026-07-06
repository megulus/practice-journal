'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { bottomNavItems } from './navItems'
import { isActivePath } from './isActivePath'

/**
 * Mobile / tablet bottom tab nav. Hidden at the desktop breakpoint (`lg`),
 * where {@link SideNav} takes over.
 */
export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border-default bg-card-bg safe-area-pb lg:hidden">
      <div className="mx-auto flex h-16 max-w-lg items-center justify-around">
        {bottomNavItems.map(({ label, href, icon: Icon }) => {
          const active = isActivePath(pathname, href)
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center gap-0.5 px-3 py-2 text-xs transition-colors ${
                active ? 'text-nav-active font-semibold' : 'text-nav-inactive'
              }`}
            >
              <Icon size={20} strokeWidth={1.5} aria-hidden />
              <span>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
