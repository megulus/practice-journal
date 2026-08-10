import type { HeatmapDay } from '@/lib/types'

// ---------------------------------------------------------------------------
// Layout maths for the practice calendar (spec §5.7, "Practice calendar
// heatmap"). Kept out of the component so the week bucketing and the
// intensity mapping are testable without rendering.
// ---------------------------------------------------------------------------

export type HeatmapLevel = 0 | 1 | 2 | 3 | 4

export interface HeatmapCell {
  /** `YYYY-MM-DD`. */
  date: string
  minutes: number
  level: HeatmapLevel
  /** True for days after `today` — rendered as blank space, not an empty square. */
  future: boolean
}

export interface HeatmapWeek {
  /** Seven slots, Monday first. `null` where the week runs outside the year. */
  days: (HeatmapCell | null)[]
  /** Short month name when this column contains the 1st of a month. */
  monthLabel: string | null
}

/**
 * Minute thresholds between the five teal ramp levels (design tokens §2).
 *
 * Deliberately absolute rather than scaled to the user's own maximum: with a
 * relative ramp a square you earned last week can fade as later sessions get
 * longer, which reads as losing ground. `< 15` light, `< 30` medium,
 * `< 60` dark, `>= 60` full.
 */
export const LEVEL_THRESHOLDS = [15, 30, 60] as const

export function heatmapLevel(minutes: number): HeatmapLevel {
  if (minutes <= 0) return 0
  if (minutes < LEVEL_THRESHOLDS[0]) return 1
  if (minutes < LEVEL_THRESHOLDS[1]) return 2
  if (minutes < LEVEL_THRESHOLDS[2]) return 3
  return 4
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

function toKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** Monday of the week containing `d` (local time, no mutation of `d`). */
function mondayOf(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  // getDay(): 0 = Sunday. Monday-first means Sunday is 6 days into the week.
  out.setDate(out.getDate() - ((out.getDay() + 6) % 7))
  return out
}

/**
 * Bucket a year's practice days into Monday-first week columns.
 *
 * Rows are days of the week and each column is a week, with month names above
 * the column that holds the 1st — the GitHub contribution grid the spec asks
 * for. A whole year of days can't fit in twelve literal columns, so "columns
 * are months" from spec §5.7 lands as the month label row.
 */
export function buildHeatmapWeeks(
  year: number,
  days: HeatmapDay[],
  today: Date = new Date(),
): HeatmapWeek[] {
  const minutesByDate = new Map<string, number>()
  for (const day of days) {
    minutesByDate.set(day.date, (minutesByDate.get(day.date) ?? 0) + day.duration_minutes)
  }

  const yearStart = new Date(year, 0, 1)
  const yearEnd = new Date(year, 11, 31)
  const todayKey = toKey(today)

  const weeks: HeatmapWeek[] = []
  const cursor = mondayOf(yearStart)

  while (cursor <= yearEnd) {
    const week: HeatmapWeek = { days: [], monthLabel: null }
    for (let i = 0; i < 7; i++) {
      const d = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + i)
      if (d.getFullYear() !== year) {
        week.days.push(null)
        continue
      }
      if (d.getDate() === 1 && week.monthLabel === null) {
        week.monthLabel = MONTHS[d.getMonth()]
      }
      const date = toKey(d)
      const minutes = minutesByDate.get(date) ?? 0
      week.days.push({
        date,
        minutes,
        level: heatmapLevel(minutes),
        future: date > todayKey,
      })
    }
    weeks.push(week)
    cursor.setDate(cursor.getDate() + 7)
  }

  return weeks
}

/**
 * The year to chart: the browser's local one.
 *
 * Deliberately local rather than UTC, and deliberately a named function so a
 * test can pin that choice. `buildHeatmapWeeks` decides which cells are still
 * in the future from the local date, so asking the heatmap endpoint for the
 * UTC year would let the two disagree — west of UTC on New Year's Eve the
 * server would hand back next year and every cell would render blank.
 */
export function localYear(now: Date = new Date()): number {
  return now.getFullYear()
}

/**
 * Where to park the horizontal scroll on first render: far enough right that
 * the current week sits at the right edge.
 *
 * Scrolling all the way to the end would land on the blank future weeks of the
 * year, and starting at the left would open on January — neither is the part
 * of the calendar anyone wants first.
 */
export function heatmapScrollLeft(
  weeks: HeatmapWeek[],
  viewportWidth: number,
  { cell, gap, labelWidth }: { cell: number; gap: number; labelWidth: number },
): number {
  let lastPast = -1
  for (let i = 0; i < weeks.length; i++) {
    if (weeks[i].days.some((d) => d !== null && !d.future)) lastPast = i
  }
  if (lastPast < 0) return 0
  const rightEdge = labelWidth + gap + (lastPast + 1) * (cell + gap)
  return Math.max(0, rightEdge - viewportWidth)
}

/** "Mon, Mar 3 — 45 min" / "Mon, Mar 3 — no practice", for the cell tooltip. */
export function heatmapCellLabel(cell: HeatmapCell): string {
  const [y, m, d] = cell.date.split('-').map(Number)
  const label = new Date(y, m - 1, d).toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  return cell.minutes > 0
    ? `${label} — ${cell.minutes} min`
    : `${label} — no practice`
}
