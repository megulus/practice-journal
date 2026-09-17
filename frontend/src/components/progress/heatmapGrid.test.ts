import { describe, it, expect } from 'vitest'
import {
  buildHeatmapWeeks,
  dayLabels,
  heatmapCellLabel,
  heatmapLevel,
  heatmapScrollLeft,
  localYear,
  weekStartOf,
} from './heatmapGrid'

// 2026-01-01 is a Thursday, so the first column runs Mon 2025-12-29 → Sun
// 2026-01-04 with the first three slots outside the year.
const YEAR = 2026
const TODAY = new Date(2026, 6, 21) // Tue, Jul 21 2026
const DAYS = [
  { date: '2026-03-02', duration_minutes: 45 },
  { date: '2026-03-03', duration_minutes: 10 },
]

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
    const weeks = buildHeatmapWeeks(YEAR, [], 'monday', TODAY)
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
    const weeks = buildHeatmapWeeks(YEAR, [], 'monday', TODAY)
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
      'monday',
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
      'monday',
      TODAY,
    )
    const cell = cellsFor(weeks).find((c) => c!.date === '2026-03-02')
    expect(cell).toMatchObject({ minutes: 45, level: 3 })
  })

  it('marks days after today as future so they render blank', () => {
    const weeks = buildHeatmapWeeks(YEAR, [], 'monday', TODAY)
    const byDate = new Map(cellsFor(weeks).map((c) => [c!.date, c!]))

    expect(byDate.get('2026-07-20')!.future).toBe(false)
    expect(byDate.get('2026-07-21')!.future).toBe(false)
    expect(byDate.get('2026-07-22')!.future).toBe(true)
    expect(byDate.get('2026-12-31')!.future).toBe(true)
  })

  it('handles a leap year', () => {
    const cells = cellsFor(buildHeatmapWeeks(2028, [], 'monday', new Date(2028, 11, 31)))
    expect(cells).toHaveLength(366)
    expect(cells.some((c) => c!.date === '2028-02-29')).toBe(true)
  })

  it('defaults to Monday-first, so an un-set preference is the old grid', () => {
    // The backend's `week_starts_on` column defaults to 'monday'; this pins
    // that the grid's default matches it rather than being merely arbitrary.
    expect(buildHeatmapWeeks(YEAR, DAYS, undefined, TODAY)).toEqual(
      buildHeatmapWeeks(YEAR, DAYS, 'monday', TODAY),
    )
  })

  it('anchors the columns to Sunday when the preference says so', () => {
    const weeks = buildHeatmapWeeks(YEAR, [], 'sunday', TODAY)
    const cells = cellsFor(weeks)

    // Still every day of the year exactly once — only the row order moves.
    expect(cells).toHaveLength(365)
    expect(cells[0]!.date).toBe('2026-01-01')
    expect(cells[cells.length - 1]!.date).toBe('2026-12-31')
    expect(new Set(cells.map((c) => c!.date)).size).toBe(365)
    expect(weeks.every((w) => w.days.length === 7)).toBe(true)

    // The first column now runs Sun 2025-12-28 → Sat 2026-01-03, so Jan 1
    // (a Thursday) lands at index 4 behind four nulls — one more than the
    // Monday-first grid's three.
    expect(weeks[0].days.slice(0, 4)).toEqual([null, null, null, null])
    expect(weeks[0].days[4]!.date).toBe('2026-01-01')
  })

  it('moves a day between rows with the week start, and only that', () => {
    const rowOf = (weeks: ReturnType<typeof buildHeatmapWeeks>, date: string) => {
      for (const week of weeks) {
        const i = week.days.findIndex((d) => d?.date === date)
        if (i !== -1) return i
      }
      return -1
    }
    const monday = buildHeatmapWeeks(YEAR, [], 'monday', TODAY)
    const sunday = buildHeatmapWeeks(YEAR, [], 'sunday', TODAY)

    // Sun Mar 1 2026 closes a Monday-first week and opens a Sunday-first one;
    // Mon Mar 2 does the reverse.
    expect(rowOf(monday, '2026-03-01')).toBe(6)
    expect(rowOf(sunday, '2026-03-01')).toBe(0)
    expect(rowOf(monday, '2026-03-02')).toBe(0)
    expect(rowOf(sunday, '2026-03-02')).toBe(1)
  })

  it('still labels every month under a Sunday-first grid', () => {
    const weeks = buildHeatmapWeeks(YEAR, [], 'sunday', TODAY)
    expect(weeks.map((w) => w.monthLabel).filter(Boolean)).toEqual([
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ])
  })

  it('keeps minutes and future flags attached to the date, not the row', () => {
    const sunday = buildHeatmapWeeks(YEAR, DAYS, 'sunday', TODAY)
    const byDate = new Map(cellsFor(sunday).map((c) => [c!.date, c!]))

    expect(byDate.get('2026-03-02')).toMatchObject({ minutes: 45, level: 3 })
    expect(byDate.get('2026-03-03')).toMatchObject({ minutes: 10, level: 1 })
    expect(byDate.get('2026-07-21')!.future).toBe(false)
    expect(byDate.get('2026-07-22')!.future).toBe(true)
  })
})

describe('weekStartOf', () => {
  // Mirrors the backend's `_week_start_date` (app/api/progress_api.py), which
  // anchors the comparison and rating-trend windows the grid sits above. If
  // these two ever disagree the charts and the calendar disagree about "week".
  const WEEK = [
    new Date(2026, 2, 2), // Mon Mar 2
    new Date(2026, 2, 3),
    new Date(2026, 2, 4),
    new Date(2026, 2, 5),
    new Date(2026, 2, 6),
    new Date(2026, 2, 7),
    new Date(2026, 2, 8), // Sun Mar 8
  ]

  it('sends every day of a Mon–Sun run back to that Monday', () => {
    for (const d of WEEK) {
      expect(weekStartOf(d, 'monday').toDateString()).toBe(
        new Date(2026, 2, 2).toDateString(),
      )
    }
  })

  it('splits the same run at Sunday when Sunday starts the week', () => {
    // Mon Mar 2 – Sat Mar 7 belong to the week that began Sun Mar 1; Sun Mar 8
    // starts the next one.
    for (const d of WEEK.slice(0, 6)) {
      expect(weekStartOf(d, 'sunday').toDateString()).toBe(
        new Date(2026, 2, 1).toDateString(),
      )
    }
    expect(weekStartOf(WEEK[6], 'sunday').toDateString()).toBe(
      new Date(2026, 2, 8).toDateString(),
    )
  })

  it('does not mutate the date it is given', () => {
    const d = new Date(2026, 2, 8, 13, 30)
    weekStartOf(d, 'monday')
    expect(d.getDate()).toBe(8)
    expect(d.getHours()).toBe(13)
  })
})

describe('dayLabels', () => {
  it('labels the same three weekdays whichever day starts the week', () => {
    expect(dayLabels('monday')).toEqual(['Mon', '', 'Wed', '', 'Fri', '', ''])
    expect(dayLabels('sunday')).toEqual(['', 'Mon', '', 'Wed', '', 'Fri', ''])
  })

  it('always returns one label per row', () => {
    expect(dayLabels('monday')).toHaveLength(7)
    expect(dayLabels('sunday')).toHaveLength(7)
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
    const weeks = buildHeatmapWeeks(YEAR, [], 'monday', TODAY)
    // Jul 21 lands in column 29. The target is 26 + 3 + 30 * 14 = 449, which
    // is that column's right edge plus one 3px inter-column gap — a deliberate
    // sliver of gutter, not the exact edge.
    expect(heatmapScrollLeft(weeks, 300, METRICS)).toBe(149)
  })

  it('does not scroll past the current week into the blank future', () => {
    const weeks = buildHeatmapWeeks(YEAR, [], 'monday', TODAY)
    const fullWidth = METRICS.labelWidth + METRICS.gap + weeks.length * 14
    expect(heatmapScrollLeft(weeks, 300, METRICS)).toBeLessThan(fullWidth - 300)
  })

  it('stays put when the whole year already fits', () => {
    const weeks = buildHeatmapWeeks(YEAR, [], 'monday', TODAY)
    expect(heatmapScrollLeft(weeks, 2000, METRICS)).toBe(0)
  })

  it('stays put for a year that has not started', () => {
    const weeks = buildHeatmapWeeks(2027, [], 'monday', TODAY)
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
