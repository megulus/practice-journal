import { describe, it, expect } from 'vitest'
import { createAttemptKey, newIdempotencyKey } from './idempotency'

describe('newIdempotencyKey', () => {
  it('returns a distinct key each time', () => {
    const keys = new Set(Array.from({ length: 50 }, () => newIdempotencyKey()))
    expect(keys.size).toBe(50)
  })
})

describe('createAttemptKey', () => {
  it('keeps one key while the payload is unchanged', () => {
    const attemptKey = createAttemptKey()
    const payload = { plan_name: 'Bruch', minutes: 30 }

    expect(attemptKey(payload)).toBe(attemptKey(payload))
    // A structurally equal payload is the same attempt, not a new one.
    expect(attemptKey({ plan_name: 'Bruch', minutes: 30 })).toBe(
      attemptKey(payload),
    )
  })

  it('mints a new key when the payload changes', () => {
    const attemptKey = createAttemptKey()
    const first = attemptKey({ plan_name: 'Bruch', minutes: 30 })
    const second = attemptKey({ plan_name: 'Bruch', minutes: 60 })

    expect(second).not.toBe(first)
    // And the new one is now the stable key.
    expect(attemptKey({ plan_name: 'Bruch', minutes: 60 })).toBe(second)
  })

  it('gives each attempt tracker its own key', () => {
    const payload = { plan_name: 'Bruch' }
    expect(createAttemptKey()(payload)).not.toBe(createAttemptKey()(payload))
  })
})
