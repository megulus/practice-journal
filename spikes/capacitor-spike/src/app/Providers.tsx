'use client'

import { ClerkProvider } from '@clerk/clerk-react'
import { CLERK_PUBLISHABLE_KEY, CLERK_STANDARD_BROWSER } from '@/lib/env'

/**
 * Phase B: Clerk wired through the **SPA** package (`@clerk/clerk-react`), not
 * `@clerk/nextjs`. The Next integration is middleware-based and `output:
 * 'export'` emits no middleware, so none of its route protection exists here.
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  if (!CLERK_PUBLISHABLE_KEY) {
    return (
      <div>
        <strong>No NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY at build time.</strong>
        <p>Set it in .env.local and rebuild — see README.</p>
        {children}
      </div>
    )
  }
  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      standardBrowser={CLERK_STANDARD_BROWSER}
    >
      {children}
    </ClerkProvider>
  )
}
