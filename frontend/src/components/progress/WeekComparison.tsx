'use client'

import { StatCard } from '@/components/ui'
import { formatDuration } from '@/lib/duration'
import type { ComparisonResponse, WeekStats } from '@/lib/types'

const DAY_ORDER = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
] as const

const DAY_SHORT: Record<(typeof DAY_ORDER)[number], string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
}

/** Tallest bar, in px. */
const CHART_HEIGHT = 64

function minutesByDay(week: WeekStats): Record<string, number> {
  const out: Record<string, number> = {}
  for (const d of week.daily) out[d.day] = d.minutes
  return out
}

function dayCount(n: number): string {
  return `${n} day${n === 1 ? '' : 's'}`
}

/**
 * Delta line for the current week, e.g. "+1 day vs. last week". A negative
 * delta is stated plainly rather than softened — the chart below already shows
 * where the week went, and hiding a down week would make the up weeks mean
 * less.
 */
function deltaLabel(delta: number): string {
  if (delta === 0) return 'Same as last week'
  const sign = delta > 0 ? '+' : '−'
  return `${sign}${dayCount(Math.abs(delta))} vs. last week`
}

/**
 * "This week vs. last" (spec §5.7, Insights #2): two stat cards over a paired
 * daily bar chart — teal for this week, gray for last. Answers "am I
 * practicing consistently?"
 *
 * The daily breakdown the API returns is always Monday-first, so the chart is
 * too, regardless of which day the user's week starts on (that setting decides
 * which sessions land in which week, not the axis order).
 */
export function WeekComparison({ data }: { data: ComparisonResponse }) {
  const thisWeek = minutesByDay(data.this_week)
  const lastWeek = minutesByDay(data.last_week)
  const max = Math.max(
    1,
    ...DAY_ORDER.map((d) => Math.max(thisWeek[d] ?? 0, lastWeek[d] ?? 0)),
  )

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          value={dayCount(data.this_week.days_practiced)}
          label="This week"
        >
          <p className="text-[11px] leading-tight text-text-secondary">
            {formatDuration(data.this_week.total_minutes)} total
          </p>
          <p
            className={
              data.delta_days > 0
                ? 'text-[11px] leading-tight text-primary'
                : 'text-[11px] leading-tight text-text-tertiary'
            }
          >
            {deltaLabel(data.delta_days)}
          </p>
        </StatCard>

        <StatCard
          value={dayCount(data.last_week.days_practiced)}
          label="Last week"
        >
          <p className="text-[11px] leading-tight text-text-secondary">
            {formatDuration(data.last_week.total_minutes)} total
          </p>
          <p className="text-[11px] leading-tight text-text-tertiary">—</p>
        </StatCard>
      </div>

      <div className="mt-3 flex items-center justify-center gap-3 text-[11px] text-text-secondary">
        <span className="flex items-center gap-1">
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2 rounded-sm bg-primary"
          />
          This week
        </span>
        <span className="flex items-center gap-1">
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2 rounded-sm bg-pill-inactive-text"
          />
          Last week
        </span>
      </div>

      <div
        className="mt-2 flex items-end justify-between gap-1"
        role="img"
        aria-label={`Daily practice minutes. This week: ${DAY_ORDER.map(
          (d) => `${DAY_SHORT[d]} ${thisWeek[d] ?? 0} minutes`,
        ).join(', ')}. Last week: ${DAY_ORDER.map(
          (d) => `${DAY_SHORT[d]} ${lastWeek[d] ?? 0} minutes`,
        ).join(', ')}.`}
      >
        {DAY_ORDER.map((day) => {
          const now = thisWeek[day] ?? 0
          const prev = lastWeek[day] ?? 0
          return (
            <div key={day} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="flex items-end justify-center gap-[3px]"
                style={{ height: CHART_HEIGHT }}
              >
                <Bar
                  minutes={now}
                  max={max}
                  className="bg-primary"
                  title={`${DAY_SHORT[day]}, this week — ${now} min`}
                  testId={`bar-this-${day}`}
                />
                <Bar
                  minutes={prev}
                  max={max}
                  className="bg-pill-inactive-text"
                  title={`${DAY_SHORT[day]}, last week — ${prev} min`}
                  testId={`bar-last-${day}`}
                />
              </div>
              <span className="text-[10px] text-text-tertiary">
                {DAY_SHORT[day]}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Bar({
  minutes,
  max,
  className,
  title,
  testId,
}: {
  minutes: number
  max: number
  className: string
  title: string
  testId: string
}) {
  // A practiced day always gets a visible sliver, so a 5-minute day next to a
  // two-hour one still reads as "I showed up".
  const height = minutes > 0 ? Math.max(3, (minutes / max) * CHART_HEIGHT) : 0
  return (
    <div
      data-testid={testId}
      data-minutes={minutes}
      title={title}
      className={`w-2 rounded-t-sm ${minutes > 0 ? className : ''}`}
      style={{ height }}
    />
  )
}
