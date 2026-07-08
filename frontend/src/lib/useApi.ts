'use client'

import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useMemo } from 'react'
import { createAuthenticatedAPI } from './api'

/**
 * Authenticated API client. Injects Clerk JWTs into every request and, on a
 * persistent 401 (after the client's token refresh-and-retry), redirects to
 * sign-in so a dead session doesn't leave the user staring at errors.
 */
export function useApi() {
  const { getToken } = useAuth()
  const router = useRouter()

  const api = useMemo(
    () => createAuthenticatedAPI(getToken, () => router.push('/sign-in')),
    [getToken, router]
  )

  return api
}
