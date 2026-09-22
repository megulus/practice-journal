'use client'

import { SignedIn, SignedOut, useAuth, useUser, useClerk } from '@clerk/clerk-react'
import { useEffect, useState } from 'react'
import { API_URL } from '@/lib/env'

/**
 * Phase B: a "protected" route with no middleware — the only gate available in
 * a static export is client-side. Also Phase B5/D1: does the Clerk token reach
 * the API from the webview origin?
 */
export default function Protected() {
  const { isLoaded, isSignedIn, getToken, sessionId } = useAuth()
  const { user } = useUser()
  const clerk = useClerk()
  const [token, setToken] = useState<string>('(not fetched)')
  const [apiResult, setApiResult] = useState<string>('(not called)')
  const [storage, setStorage] = useState<string>('')
  // NEXT_PUBLIC_API_URL is baked in at build time, which is useless on a phone
  // that needs to reach a laptop on the LAN. Keep an override in localStorage
  // so the base URL can change without a rebuild.
  const [apiBase, setApiBase] = useState<string>(API_URL)

  useEffect(() => {
    const saved = localStorage.getItem('spike.apiBase')
    if (saved) setApiBase(saved)
  }, [])

  useEffect(() => {
    // Phase B4: where does the session actually live?
    const ls = Object.keys(localStorage).filter((k) => /clerk|__client|session/i.test(k))
    const cookies = document.cookie
      .split(';')
      .map((c) => c.trim().split('=')[0])
      .filter(Boolean)
    setStorage(
      JSON.stringify(
        { localStorageKeys: ls, cookieNames: cookies, origin: location.origin },
        null,
        2,
      ),
    )
  }, [isSignedIn])

  function saveBase(v: string) {
    setApiBase(v)
    localStorage.setItem('spike.apiBase', v)
  }

  async function callApi(path: string, withToken: boolean) {
    setApiResult('(calling…)')
    try {
      const t = withToken ? await getToken() : null
      if (withToken) setToken(t ? `${t.slice(0, 24)}… (${t.length} chars)` : '(null)')
      const res = await fetch(`${apiBase}${path}`, {
        headers: t ? { Authorization: `Bearer ${t}` } : {},
      })
      setApiResult(`${res.status} ${res.statusText} — ${(await res.text()).slice(0, 400)}`)
    } catch (e) {
      // A CORS rejection surfaces here as an opaque TypeError: "Failed to
      // fetch". The status code never reaches JS — check the server log.
      setApiResult(`fetch threw: ${String(e)}`)
    }
  }

  return (
    <main style={{ padding: 12, fontFamily: 'system-ui' }}>
      <h1>protected</h1>
      <SignedOut>
        <p id="signed-out">SIGNED OUT — a real app would redirect to /sign-in here.</p>
        <a href="/sign-in">go to /sign-in</a>
      </SignedOut>
      <SignedIn>
        <p id="signed-in">SIGNED IN</p>
        <p>loaded: {String(isLoaded)} · sessionId: <code id="session-id">{sessionId}</code></p>
        <p>email: <code id="user-email">{user?.primaryEmailAddress?.emailAddress}</code></p>
      </SignedIn>

      {/* Phase D1. Outside the auth gate on purpose: the CORS/Origin probe is
          worth running before you can sign in, not just after. */}
      <h2>api probe</h2>
      <p>
        API base{' '}
        <input
          id="api-base"
          value={apiBase}
          onChange={(e) => saveBase(e.target.value)}
          style={{ width: '70%', fontSize: 16 }}
        />
      </p>
      <button id="call-api" onClick={() => callApi('/api/user/me', true)}>
        getToken() + GET /api/user/me
      </button>{' '}
      <button id="call-echo" onClick={() => callApi('/__echo', true)}>
        GET /__echo (cors-echo-server)
      </button>
      <p>token: <code id="token">{token}</code></p>
      <p>api: <code id="api-result">{apiResult}</code></p>

      <SignedIn>
        <button id="sign-out" onClick={() => clerk.signOut()}>sign out</button>{' '}
        {/* Phase B6: Apple requires an in-app account deletion path. */}
        <button
          id="delete-account"
          onClick={async () => {
            if (confirm('really delete this Clerk user?')) await user?.delete()
          }}
        >
          delete account (user.delete())
        </button>
      </SignedIn>
      <h2>where the session lives</h2>
      <pre id="session-storage" style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{storage}</pre>
      <p><a href="/">home</a></p>
    </main>
  )
}
