/** Structural subset of Clerk's user object — avoids importing Clerk types. */
interface ClerkUserLike {
  firstName?: string | null
  lastName?: string | null
  primaryEmailAddress?: { emailAddress?: string | null } | null
}

export interface UserDisplay {
  name: string
  email: string
  initials: string
}

/**
 * Derive the display name, email, and avatar initials shown in the nav from a
 * Clerk user. Falls back gracefully when name or email is missing.
 */
export function getUserDisplay(user: ClerkUserLike | null | undefined): UserDisplay {
  const first = user?.firstName ?? ''
  const last = user?.lastName ?? ''
  const email = user?.primaryEmailAddress?.emailAddress ?? ''

  const name = [first, last].filter(Boolean).join(' ') || email || 'Account'
  const initials =
    ((first[0] ?? '') + (last[0] ?? '')).toUpperCase() ||
    email[0]?.toUpperCase() ||
    '?'

  return { name, email, initials }
}
