import { describe, it, expect } from 'vitest'
import {
  buildHeatmapWeeks,
  heatmapCellLabel,
  heatmapLevel,
  heatmapScrollLeft,
  localYear,
} from './heatmapGrid'

// 2026-01-01 is a Thursday, so the first column runs Mon 2025-12-29 → Sun
// 2026-01-04 with the first three slots outside the year.
const YEAR = 2026
const TODAY = new Date(2026, 6, 21) // Tue, Jul 21 2026

function cellsFor(weeks: ReturnType<typeof buildHeatmapWeeks>) {
  return weeks.flatMap((w) => w.days).filter((d) => d !== null)
}

describe('heatmapLevel', () => {
  it('maps minutes onto the five teal ramp levels', () => {
    expect(heatmapLevel(0)).toBe(0)
    expect(heatmapLevel(1)).toBe(1)
    expect(heatmapLevel(14)).toBe(1)
    expect(heatmapLevel(15)).toBe(2)
    expect(heatmapLevel(29)).toBe(2)
    expect(heatmapLevel(30)).toBe(3)
    expect(heatmapLevel(59)).toBe(3)
    expect(heatmapLevel(60)).toBe(4)
    expect(heatmapLevel(240)).toBe(4)
  })
})

describe('buildHeatmapWeeks', () => {
  it('covers every day of the year exactly once, Monday-first', () => {
    const weeks = buildHeatmapWeeks(YEAR, [], TODAY)
    const cells = cellsFor(weeks)

    expect(cells).toHaveLength(365)
    expect(cells[0]!.date).toBe('2026-01-01')
    expect(cells[cells.length - 1]!.date).toBe('2026-12-31')
    expect(new Set(cells.map((c) => c!.date)).size).toBe(365)

    // Jan 1 2026 is a Thursday → index 3 of the first column, with Mon–Wed
    // padded out as nulls.
    expect(weeks[0].days.slice(0, 3)).toEqual([null, null, null])
    expect(weeks[0].days[3]!.date).toBe('2026-01-01')
    expect(weeks.every((w) => w.days.length === 7)).toBe(true)
  })

  it('labels the column that contains the first of each month', () => {
    const weeks = buildHeatmapWeeks(YEAR, [], TODAY)
    const labels = weeks.map((w) => w.monthLabel).filter(Boolean)

    expect(labels).toEqual([
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ])
  })

  it('attaches minutes and intensity to the matching day', () => {
    const weeks = buildHeatmapWeeks(
      YEAR,
      [
        { date: '2026-03-02', duration_minutes: 45 },
        { date: '2026-03-03', duration_minutes: 10 },
      ],
      TODAY,
    )
    const byDate = new Map(cellsFor(weeks).map((c) => [c!.date, c!]))

    expect(byDate.get('2026-03-02')).toMatchObject({ minutes: 45, level: 3 })
    expect(byDate.get('2026-03-03')).toMatchObject({ minutes: 10, level: 1 })
    expect(byDate.get('2026-03-04')).toMatchObject({ minutes: 0, level: 0 })
  })

  it('sums duplicate rows for the same date', () => {
    const weeks = buildHeatmapWeeks(
      YEAR,
      [
        { date: '2026-03-02', duration_minutes: 20 },
        { date: '2026-03-02', duration_minutes: 25 },
      ],
      TODAY,
    )
    const cell = cellsFor(weeks).find((c) => c!.date === '2026-03-02')
    expect(cell).toMatchObject({ minutes: 45, level: 3 })
  })

  it('marks days after today as future so they render blank', () => {
    const weeks = buildHeatmapWeeks(YEAR, [], TODAY)
    const byDate = new Map(cellsFor(weeks).map((c) => [c!.date, c!]))

    expect(byDate.get('2026-07-20')!.future).toBe(false)
    expect(byDate.get('2026-07-21')!.future).toBe(false)
    expect(byDate.get('2026-07-22')!.future).toBe(true)
    expect(byDate.get('2026-12-31')!.future).toBe(true)
  })

  it('handles a leap year', () => {
    const cells = cellsFor(buildHeatmapWeeks(2028, [], new Date(2028, 11, 31)))
    expect(cells).toHaveLength(366)
    expect(cells.some((c) => c!.date === '2028-02-29')).toBe(true)
  })
})

describe('heatmapCellLabel', () => {
  it('reads out the date and duration', () => {
    expect(
      heatmapCellLabel({
        date: '2026-03-02',
        minutes: 45,
        level: 3,
        future: false,
      }),
    ).toBe('Mon, Mar 2 — 45 min')
  })

  it('says so when nothing was practiced', () => {
    expect(
      heatmapCellLabel({
        date: '2026-03-03',
        minutes: 0,
        level: 0,
        future: false,
      }),
    ).toBe('Tue, Mar 3 — no practice')
  })
})

describe('heatmapScrollLeft', () => {
  const METRICS = { cell: 11, gap: 3, labelWidth: 26 }

  it('puts the current week at the right edge of the viewport', () => {
    const weeks = buildHeatmapWeeks(YEAR, [], TODAY)
    // Jul 21 lands in column 29. The target is 26 + 3 + 30 * 14 = 449, which
    // is that column's right edge plus one 3px inter-column gap — a deliberate
    // sliver of gutter, not the exact edge.
    expect(heatmapScrollLeft(weeks, 300, METRICS)).toBe(149)
  })

  it('does not scroll past the current week into the blank future', () => {
    const weeks = buildHeatmapWeeks(YEAR, [], TODAY)
    const fullWidth = METRICS.labelWidth + METRICS.gap + weeks.length * 14
    expect(heatmapScrollLeft(weeks, 300, METRICS)).toBeLessThan(fullWidth - 300)
  })

  it('stays put when the whole year already fits', () => {
    const weeks = buildHeatmapWeeks(YEAR, [], TODAY)
    expect(heatmapScrollLeft(weeks, 2000, METRICS)).toBe(0)
  })

  it('stays put for a year that has not started', () => {
    const weeks = buildHeatmapWeeks(2027, [], TODAY)
    expect(heatmapScrollLeft(weeks, 300, METRICS)).toBe(0)
  })
})

describe('localYear', () => {
  it('reads the local year, not the UTC one', () => {
    // A stub whose two clocks disagree, so this holds regardless of the test
    // runner's timezone (which is UTC, where a real Date can't tell them
    // apart). Switching the implementation to getUTCFullYear fails here.
    const newYearsEveWestOfUtc = {
      getFullYear: () => 2026,
      getUTCFullYear: () => 2027,
    } as unknown as Date

    expect(localYear(newYearsEveWestOfUtc)).toBe(2026)
  })

  it('defaults to now', () => {
    expect(localYear()).toBe(new Date().getFullYear())
  })
})
