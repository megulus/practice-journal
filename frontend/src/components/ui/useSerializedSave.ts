'use client'

import { useCallback, useRef, useState } from 'react'

export interface SerializedSave<T> {
  /** Queue a save. Resolves when *this* save has completed. */
  save: (value: T) => Promise<void>
  /** True from the first queued save until the last one settles. */
  saving: boolean
}

/**
 * Runs saves one at a time, in call order.
 *
 * Dictation commits a save per finalized phrase, so without this several
 * PATCHes to the same row are in flight at once: the server doesn't promise
 * to apply them in send order, so a slow early request can land after a later
 * one and resurrect stale text. A shared "saving" flag would also clear when
 * the *first* response arrived rather than the last.
 *
 * The chain survives a rejection so a failed save can't wedge the queue, but
 * the promise handed back still rejects — callers (blur, the Finish flush)
 * keep their existing error handling.
 */
export function useSerializedSave<T>(
  save: (value: T) => Promise<void>,
): SerializedSave<T> {
  const [saving, setSaving] = useState(false)
  const chainRef = useRef<Promise<unknown>>(Promise.resolve())
  const pendingRef = useRef(0)

  const saveRef = useRef(save)
  saveRef.current = save

  const run = useCallback((value: T) => {
    pendingRef.current += 1
    setSaving(true)

    const next = chainRef.current.then(() => saveRef.current(value))
    // Keep the queue alive after a failure; the rejection is re-surfaced on
    // the promise returned to the caller, not on the chain.
    chainRef.current = next.catch(() => {})

    return next.finally(() => {
      pendingRef.current -= 1
      if (pendingRef.current === 0) setSaving(false)
    })
  }, [])

  return { save: run, saving }
}
