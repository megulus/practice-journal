import { describe, it, expect } from 'vitest'
import { isActivePath } from './isActivePath'

describe('isActivePath', () => {
  it('matches the exact path', () => {
    expect(isActivePath('/plans', '/plans')).toBe(true)
  })

  it('matches a nested route under the href', () => {
    expect(isActivePath('/plans/42', '/plans')).toBe(true)
  })

  it('does not match a different path', () => {
    expect(isActivePath('/today', '/plans')).toBe(false)
  })

  it('does not match a sibling with a shared prefix', () => {
    expect(isActivePath('/plansmore', '/plans')).toBe(false)
  })

  it('returns false for a null pathname', () => {
    expect(isActivePath(null, '/plans')).toBe(false)
  })
})
