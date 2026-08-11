import { describe, it, expect } from 'vitest'
import { ratingTrendSummary, weekAgoLabel } from './ratingTrendSummary'
import type { RatingsWeek } from '@/lib/types'

function week(
  week_start: string,
  step_forward: number,
  steady: number,
  step_back: number,
): RatingsWeek {
  return {
    week_start,
    step_forward,
    steady,
    step_back,
    total: step_forward + steady + step_back,
  }
}

describe('ratingTrendSummary', () => {
  it('nudges toward rating when nothing has been rated', () => {
    expect(ratingTrendSummary([])).toMatch(/No ratings yet/)
    expect(
      ratingTrendSummary([week('2026-07-20', 0, 0, 0), week('2026-07-13', 0, 0, 0)]),
    ).toMatch(/No ratings yet/)
  })

  it('reports the single week when there is nothing to compare against', () => {
    expect(
      ratingTrendSummary([week('2026-07-20', 3, 1, 1), week('2026-07-13', 0, 0, 0)]),
    ).toBe(
      '3 of 5 rated exercises stepped forward. One more week of ratings will show a trend.',
    )
  })

  it('singularizes a lone rated exercise', () => {
    expect(ratingTrendSummary([week('2026-07-20', 1, 0, 0)])).toMatch(
      /1 of 1 rated exercise stepped forward/,
    )
  })

  it('calls a rising share of step-forwards trending up', () => {
    expect(
      ratingTrendSummary([
        week('2026-07-20', 8, 2, 0), // 80% forward
        week('2026-07-13', 3, 7, 0), // 30%
        week('2026-07-06', 2, 8, 0), // 20%
      ]),
    ).toMatch(/Trending up/)
  })

  it('frames a falling share as working at the edge, not as failing', () => {
    const summary = ratingTrendSummary([
      week('2026-07-20', 1, 4, 5), // 10% forward
      week('2026-07-13', 7, 3, 0), // 70%
    ])
    expect(summary).toMatch(/More step-backs lately/)
    expect(summary).toMatch(/edge of what you can do/)
  })

  it('calls a flat share steady', () => {
    expect(
      ratingTrendSummary([
        week('2026-07-20', 5, 5, 0),
        week('2026-07-13', 5, 5, 0),
        week('2026-07-06', 4, 6, 0),
      ]),
    ).toMatch(/Holding steady/)
  })

  it('ignores weeks with no ratings when comparing', () => {
    // The empty week in the middle must not count as a 0% forward week.
    expect(
      ratingTrendSummary([
        week('2026-07-20', 9, 1, 0),
        week('2026-07-13', 0, 0, 0),
        week('2026-07-06', 8, 2, 0),
      ]),
    ).toMatch(/Holding steady/)
  })
})

describe('weekAgoLabel', () => {
  it('names the recent weeks in words', () => {
    expect(weekAgoLabel(0)).toBe('This week')
    expect(weekAgoLabel(1)).toBe('Last week')
    expect(weekAgoLabel(2)).toBe('2 weeks ago')
    expect(weekAgoLabel(3)).toBe('3 weeks ago')
  })
})
