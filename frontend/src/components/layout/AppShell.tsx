'use client'

import BottomNav from './BottomNav'
import SideNav from './SideNav'
import MobileHeader from './MobileHeader'

/**
 * Authenticated app shell. Mounted only by `app/(app)/layout.tsx`, so by
 * construction every page wrapped here is one that should show the nav.
 *
 * Responsive layout is CSS-only (both navs render; Tailwind `lg:` toggles
 * visibility) to avoid the hydration mismatch a JS media query would cause:
 * - below `lg`: sticky {@link MobileHeader} + fixed {@link BottomNav}
 * - `lg`+: {@link SideNav} beside the content column (no top/bottom bars)
 *
 * The optional desktop secondary panel (design-tokens §11) is intentionally
 * deferred — it lands with the first screen retone that has content for it
 * (Today, #206).
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <MobileHeader />
      <div className="mx-auto flex w-full max-w-[1100px]">
        <SideNav />
        <main className="mx-auto min-w-0 w-full max-w-[520px] px-4 pb-20 pt-6 lg:px-10 lg:pb-8 lg:pt-8">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
