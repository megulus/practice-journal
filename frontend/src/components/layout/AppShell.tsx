'use client'

import BottomNav from './BottomNav'

/**
 * Authenticated app shell. Mounted only by `app/(app)/layout.tsx`, so by
 * construction every page wrapped here is one that should show the nav —
 * no per-route conditional needed.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="pb-16">
      {children}
      <BottomNav />
    </div>
  )
}
