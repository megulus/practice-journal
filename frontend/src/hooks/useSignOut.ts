import { useClerk } from '@clerk/nextjs'

/**
 * Returns a handler that ends the Clerk session and redirects to /sign-in.
 * Shared by the Profile-page button and the nav profile menus so the sign-out
 * behavior lives in one place.
 */
export function useSignOut() {
  const { signOut } = useClerk()
  return () => signOut({ redirectUrl: '/sign-in' })
}
