/**
 * Idempotency keys for retryable POSTs (#290).
 *
 * A request that commits on the server but whose response is lost on the way
 * back (dropped connection, timeout, backgrounded tab) is indistinguishable
 * from one that failed — so a retry duplicates everything it created. Sending
 * an `Idempotency-Key` lets the backend replay the original response instead.
 * See `docs/kantelo-schema-api.md` §4 "Idempotent creates".
 *
 * The key has to be *stable across retries of one attempt* and *new for a
 * fresh attempt*. `attemptKey` derives that from the payload itself: retrying
 * unchanged answers reuses the key, changing an answer mints a new one — which
 * is also exactly what the backend's payload check expects.
 */

/** A random key. `crypto.randomUUID` needs a secure context; fall back if absent. */
export function newIdempotencyKey(): string {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return uuid
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

/**
 * Holds one attempt's key, keyed by a signature of what's being sent.
 *
 * Deliberately a plain closure rather than `useMemo` — React may discard a
 * memo at any time, and a silently regenerated key is precisely the bug this
 * is here to prevent.
 */
export function createAttemptKey() {
  let current: { signature: string; key: string } | null = null

  return function attemptKey(payload: unknown): string {
    const signature = JSON.stringify(payload)
    if (current?.signature !== signature) {
      current = { signature, key: newIdempotencyKey() }
    }
    return current.key
  }
}
