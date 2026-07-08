'use client'

import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useMemo, useRef } from 'react'
import { createAuthenticatedAPI } from './api'

/**
 * Authenticated API client. Injects Clerk JWTs into every request and, on a
 * persistent 401 (after the client's token refresh-and-retry), redirects to
 * sign-in so a dead session doesn't leave the user staring at errors.
 */
export function useApi() {
  const { getToken } = useAuth()
  const router = useRouter()
  // Several requests can 401 at once on a dead session; redirect only once.
  const redirectedRef = useRef(false)

  const api = useMemo(
    () =>
      createAuthenticatedAPI(getToken, () => {
        if (redirectedRef.current) return
        redirectedRef.current = true
        router.push('/sign-in')
      }),
    [getToken, router]
  )

  return api
}
