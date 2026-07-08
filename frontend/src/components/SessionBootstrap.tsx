'use client'

import { useEffect, useRef } from 'react'
import { useApi } from '@/lib/useApi'

/**
 * Runs once at app boot for a signed-in user: calls `GET /api/user/me`, which
 * the backend uses to auto-create the Kantelo user record on first authed
 * request. Also validates the session early — a persistent 401 is handled by
 * the API client (refresh-and-retry, then redirect to sign-in). Renders nothing.
 */
export default function SessionBootstrap() {
  const api = useApi()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    // Fire-and-forget; failures are handled inside the API client.
    void api.getMe().catch(() => {})
  }, [api])

  return null
}
