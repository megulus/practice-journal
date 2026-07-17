'use client'

import { useClerk } from '@clerk/nextjs'
import { LogOut } from 'lucide-react'
import { Button } from './ui'

/**
 * Ends the Clerk session and returns to /sign-in. Clerk clears the session and
 * performs the redirect; the middleware also protects routes, so an unauthenticated
 * user can't linger even if the redirect is interrupted.
 */
export default function SignOutButton() {
  const { signOut } = useClerk()
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => signOut({ redirectUrl: '/sign-in' })}
    >
      <LogOut size={14} strokeWidth={1.5} aria-hidden />
      Sign out
    </Button>
  )
}
