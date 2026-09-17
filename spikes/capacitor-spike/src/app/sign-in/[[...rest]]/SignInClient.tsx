'use client'

import { SignIn, SignUp, SignedIn, SignedOut, UserButton } from '@clerk/clerk-react'
import { useState } from 'react'

/**
 * Phase B: Clerk's prebuilt components from the SPA package.
 *
 * `routing="hash"` because path routing would need every sub-step of the flow
 * (`/sign-in/factor-one`, `/sign-in/sso-callback`, …) prerendered by
 * `generateStaticParams`, which a static export cannot enumerate.
 */
export default function SignInClient() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  return (
    <main style={{ padding: 12, fontFamily: 'system-ui' }}>
      <SignedOut>
        <button id="toggle-mode" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
          switch to sign {mode === 'in' ? 'up' : 'in'}
        </button>
        {mode === 'in' ? <SignIn routing="hash" /> : <SignUp routing="hash" />}
      </SignedOut>
      <SignedIn>
        <p id="already-signed-in">already signed in</p>
        <UserButton />
      </SignedIn>
      <p><a href="/">home</a> · <a href="/protected">/protected</a></p>
    </main>
  )
}
