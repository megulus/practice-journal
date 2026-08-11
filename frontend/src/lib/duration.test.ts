import { describe, it, expect } from 'vitest'
import { formatDuration } from './duration'

describe('formatDuration', () => {
  it('keeps sub-hour durations in minutes', () => {
    expect(formatDuration(0)).toBe('0 min')
    expect(formatDuration(1)).toBe('1 min')
    expect(formatDuration(59)).toBe('59 min')
  })

  it('splits an hour or more into hours and minutes', () => {
    expect(formatDuration(60)).toBe('1 hr')
    expect(formatDuration(102)).toBe('1 hr 42 min')
    expect(formatDuration(120)).toBe('2 hr')
    expect(formatDuration(125)).toBe('2 hr 5 min')
  })

  it('rounds fractional minutes and floors negatives at zero', () => {
    expect(formatDuration(30.4)).toBe('30 min')
    expect(formatDuration(30.6)).toBe('31 min')
    expect(formatDuration(-5)).toBe('0 min')
  })
})
