'use client'

import BottomNav from './BottomNav'
import SideNav from './SideNav'
import MobileHeader from './MobileHeader'
import { AppChromeProvider, useAppChrome } from './appChrome'
import { cx } from '@/lib/cx'

/**
 * Authenticated app shell. Mounted only by `app/(app)/layout.tsx`, so by
 * construction every page wrapped here is one that should show the nav.
 *
 * Responsive layout is CSS-only (both navs render; Tailwind `lg:` toggles
 * visibility) to avoid the hydration mismatch a JS media query would cause:
 * - below `lg`: sticky {@link MobileHeader} + fixed {@link BottomNav}
 * - `lg`+: {@link SideNav} beside the content column (no top/bottom bars)
 *
 * A page can drop the chrome entirely via `useHideAppChrome` — the quick-start
 * wizard does this for its pre-app steps (see `./appChrome`).
 *
 * The optional desktop secondary panel (design-tokens §11) is intentionally
 * deferred — it lands with the first screen retone that has content for it
 * (Today, #206).
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AppChromeProvider>
      <AppShellFrame>{children}</AppShellFrame>
    </AppChromeProvider>
  )
}

function AppShellFrame({ children }: { children: React.ReactNode }) {
  const { hidden } = useAppChrome()

  return (
    <div>
      {!hidden && <MobileHeader />}
      <div className="mx-auto flex w-full max-w-[1100px]">
        {!hidden && <SideNav />}
        <main
          className={cx(
            'mx-auto min-w-0 w-full max-w-[520px] px-4 pt-6 lg:px-10 lg:pt-8',
            // Bottom padding clears the fixed BottomNav; without the nav the
            // page just needs ordinary breathing room.
            hidden ? 'pb-8' : 'pb-20 lg:pb-8',
          )}
        >
          {children}
        </main>
      </div>
      {!hidden && <BottomNav />}
    </div>
  )
}
