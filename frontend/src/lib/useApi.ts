'use client'

import { useAuth } from '@clerk/nextjs'
import { createAuthenticatedAPI } from './api'
import { useMemo } from 'react'

/**
 * Custom hook to get an authenticated API client
 * Uses Clerk's useAuth to automatically include JWT tokens in requests
 */
export function useApi() {
  const { getToken } = useAuth()
  
  const api = useMemo(() => {
    return createAuthenticatedAPI(getToken)
  }, [getToken])
  
  return api
}

