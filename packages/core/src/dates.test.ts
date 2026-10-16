import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  formatStartedAt,
  formatSessionDate,
  formatRelativeDay,
  formatHistoryDate,
} from './dates'

const DAY = 86_400_000

describe('dates', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Tue Jul 21 2026, noon local — away from midnight/DST boundaries.
    vi.setSystemTime(new Date(2026, 6, 21, 12, 0, 0))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  describe('formatSessionDate', () => {
    it('labels today and yesterday', () => {
      expect(formatSessionDate('2026-07-21')).toBe('Today')
      expect(formatSessionDate('2026-07-20')).toBe('Yesterday')
    })

    it('formats older dates absolutely', () => {
      const out = formatSessionDate('2026-07-15')
      expect(out).toContain('2026')
      expect(out).toContain('15')
      expect(out).not.toMatch(/today|yesterday/i)
    })

    it('returns the raw string for malformed input', () => {
      expect(formatSessionDate('not-a-date')).toBe('not-a-date')
    })
  })

  describe('formatStartedAt', () => {
    it('labels a just-now start as today', () => {
      expect(formatStartedAt(new Date().toISOString())).toMatch(/^today at /)
    })

    it('labels yesterday and N-days-ago', () => {
      expect(formatStartedAt(new Date(Date.now() - DAY).toISOString())).toMatch(
        /^yesterday at /,
      )
      expect(
        formatStartedAt(new Date(Date.now() - 3 * DAY).toISOString()),
      ).toBe('3 days ago')
    })

    it('formats older starts as a date, not a relative phrase', () => {
      const out = formatStartedAt(new Date(Date.now() - 30 * DAY).toISOString())
      expect(out).not.toMatch(/ago|today|yesterday/i)
    })

    it('treats a naive (no-tz) timestamp as UTC, not local', () => {
      // Same instant with and without the trailing Z must classify identically.
      const naive = new Date().toISOString().replace('Z', '')
      expect(formatStartedAt(naive)).toMatch(/^today at /)
    })

    it('returns empty for invalid input', () => {
      expect(formatStartedAt('garbage')).toBe('')
    })
  })

  describe('formatRelativeDay', () => {
    it('labels recent days relatively, older ones as a date', () => {
      expect(formatRelativeDay(new Date().toISOString())).toBe('today')
      expect(formatRelativeDay(new Date(Date.now() - DAY).toISOString())).toBe(
        'yesterday',
      )
      expect(
        formatRelativeDay(new Date(Date.now() - 3 * DAY).toISOString()),
      ).toBe('3 days ago')
      expect(
        formatRelativeDay(new Date(Date.now() - 30 * DAY).toISOString()),
      ).not.toMatch(/ago|today|yesterday/i)
    })

    it('returns empty for invalid input', () => {
      expect(formatRelativeDay('nope')).toBe('')
    })
  })

  describe('formatHistoryDate', () => {
    it('keeps the calendar date alongside the relative prefix', () => {
      expect(formatHistoryDate('2026-07-21')).toBe('Today, Jul 21')
      expect(formatHistoryDate('2026-07-20')).toBe('Yesterday, Jul 20')
    })

    it('uses weekday + date for older days in the current year', () => {
      // Sat Jul 18 2026.
      expect(formatHistoryDate('2026-07-18')).toBe('Sat, Jul 18')
    })

    it('adds the year once the date falls outside the current one', () => {
      expect(formatHistoryDate('2025-11-03')).toBe('Mon, Nov 3, 2025')
    })

    it('returns the raw string for malformed input', () => {
      expect(formatHistoryDate('not-a-date')).toBe('not-a-date')
    })
  })
})
