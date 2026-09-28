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
    <main className="spike-page">
      {/* First, not last: when Clerk fails to initialise, both control
          components below render null and this is the only thing on screen. */}
      <nav className="spike-nav">
        <a href="/">← home</a> · <a href="/protected">/protected</a> · <a href="/mic">/mic</a>
      </nav>
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
    </main>
  )
}
