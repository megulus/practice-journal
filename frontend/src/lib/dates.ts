// Adaptive, human-friendly formatting for session timestamps.
//
// Backend timestamps are naive UTC (no offset in the serialized string), so we
// normalize to UTC before parsing — otherwise the browser reads them as local
// time and the result is off by the timezone offset.

function parseUtc(iso: string): Date {
  const hasTz = /[zZ]$|[+-]\d\d:?\d\d$/.test(iso)
  return new Date(hasTz ? iso : `${iso}Z`)
}

function calendarDayDiff(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate())
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

/**
 * Label for an in-progress session's `started_at` (a UTC datetime), tuned to
 * signal recency/staleness at a glance:
 * today → "today at 3:12 PM", yesterday → "yesterday at 3:12 PM",
 * within a week → "3 days ago", older → "Jul 12".
 */
export function formatStartedAt(iso: string): string {
  const d = parseUtc(iso)
  if (Number.isNaN(d.getTime())) return ''
  const diff = calendarDayDiff(d, new Date())
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (diff <= 0) return `today at ${time}`
  if (diff === 1) return `yesterday at ${time}`
  if (diff < 7) return `${diff} days ago`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

/**
 * Day-granularity relative label for a UTC datetime (no time-of-day), for
 * "last practiced" copy: "today", "yesterday", "3 days ago", else "Jul 12".
 */
export function formatRelativeDay(iso: string): string {
  const d = parseUtc(iso)
  if (Number.isNaN(d.getTime())) return ''
  const diff = calendarDayDiff(d, new Date())
  if (diff <= 0) return 'today'
  if (diff === 1) return 'yesterday'
  if (diff < 7) return `${diff} days ago`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

/**
 * Label for a completed session's `practice_date` (a `YYYY-MM-DD` date):
 * "Today", "Yesterday", else "Jul 21, 2026".
 */
export function formatSessionDate(dateStr: string): string {
  const [y, m, day] = dateStr.split('-').map(Number)
  if (!y || !m || !day) return dateStr
  const d = new Date(y, m - 1, day)
  const diff = calendarDayDiff(d, new Date())
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
