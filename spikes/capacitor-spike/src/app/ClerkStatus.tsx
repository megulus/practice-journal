'use client'

import { useAuth } from '@clerk/clerk-react'
import { useEffect, useRef, useState } from 'react'

/**
 * Makes ClerkJS's startup visible.
 *
 * The problem this exists to diagnose: `<SignedIn>` and `<SignedOut>` both
 * render `null` while `isLoaded` is false **and** if Clerk never loads at all.
 * A slow cold start and a permanent failure therefore look identical — a blank
 * screen with no spinner and no error — which during this spike produced three
 * separate "Clerk is broken" moments, at least one of which resolved by itself
 * when someone waited long enough to take a screenshot.
 *
 * "Intermittent" is a worse diagnosis than "broken", so measure it: this
 * reports whether Clerk is loaded and how long it took, and starts complaining
 * once the wait is longer than a person would tolerate.
 *
 * Kantelo needs the same distinction in its real UI — see the findings note,
 * changes-table row 1a.
 */
const SLOW_MS = 3000

export default function ClerkStatus() {
  const { isLoaded } = useAuth()
  const mountedAt = useRef(Date.now())
  const [now, setNow] = useState(Date.now())
  const settledAt = useRef<number | null>(null)

  useEffect(() => {
    if (isLoaded && settledAt.current === null) settledAt.current = Date.now()
  }, [isLoaded])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(id)
  }, [])

  const elapsed = ((settledAt.current ?? now) - mountedAt.current) / 1000
  const slow = !isLoaded && now - mountedAt.current > SLOW_MS

  return (
    <p
      id="clerk-status"
      style={{
        margin: '0 0 12px',
        padding: 8,
        border: '1px solid #999',
        background: isLoaded ? '#e8f5e9' : slow ? '#ffebee' : '#fffde7',
        fontSize: 14,
      }}
    >
      {isLoaded ? (
        <>Clerk <strong>loaded</strong> after <strong>{elapsed.toFixed(1)}s</strong></>
      ) : (
        <>
          Clerk <strong>still loading</strong> — {elapsed.toFixed(1)}s
          {slow && (
            <>
              {' '}⚠️ over {SLOW_MS / 1000}s. Nothing below will render until this
              settles. Check the network and the Safari console.
            </>
          )}
        </>
      )}
    </p>
  )
}
