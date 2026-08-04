'use client'

import { ratingTrendSummary, weekAgoLabel } from './ratingTrendSummary'
import type { RatingsWeek } from '@/lib/types'

/**
 * Segment order matches the rating scale left-to-right as it reads best:
 * forward first, so a good week fills from the left. Colors are the rating
 * border tokens (design tokens §2), the same ones the History rows and the
 * chevrons use.
 */
const SEGMENTS = [
  { key: 'step_forward', label: 'Step forward', className: 'bg-rating-forward-border' },
  { key: 'steady', label: 'Steady', className: 'bg-rating-steady-border' },
  { key: 'step_back', label: 'Step back', className: 'bg-rating-back-border' },
] as const

/**
 * Rating trend, "How it's going" (spec §5.7, Insights #3): a stacked bar per
 * week showing the step back / steady / step forward mix, with a plain-language
 * read below. Answers "am I getting better?".
 *
 * `weeks` arrives most-recent-first from the API and is rendered in that order.
 */
export function RatingTrend({ weeks }: { weeks: RatingsWeek[] }) {
  return (
    <div>
      <p className="mb-3 text-xs text-text-secondary">
        Rating distribution over the last {weeks.length} week
        {weeks.length === 1 ? '' : 's'}
      </p>

      <ul className="space-y-2">
        {weeks.map((week, i) => (
          <li key={week.week_start} className="flex items-center gap-2">
            <span className="w-[68px] flex-shrink-0 text-right text-[11px] leading-tight text-text-secondary">
              {weekAgoLabel(i)}
            </span>
            <div
              data-testid={`rating-bar-${week.week_start}`}
              className="flex h-4 flex-1 overflow-hidden rounded-sm bg-card-bg-inset"
              role="img"
              aria-label={
                week.total === 0
                  ? `${weekAgoLabel(i)}: no ratings`
                  : `${weekAgoLabel(i)}: ${week.step_forward} step forward, ${week.steady} steady, ${week.step_back} step back`
              }
            >
              {week.total > 0 &&
                SEGMENTS.map((segment) => {
                  const count = week[segment.key]
                  if (count === 0) return null
                  return (
                    <div
                      key={segment.key}
                      data-testid={`segment-${segment.key}-${week.week_start}`}
                      title={`${segment.label} — ${count}`}
                      className={segment.className}
                      style={{ width: `${(count / week.total) * 100}%` }}
                    />
                  )
                })}
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-[11px] text-text-secondary">
        {SEGMENTS.map((segment) => (
          <span key={segment.key} className="flex items-center gap-1">
            <span
              aria-hidden="true"
              className={`inline-block h-2 w-2 rounded-sm ${segment.className}`}
            />
            {segment.label}
          </span>
        ))}
      </div>

      <p className="mt-3 text-center text-xs text-primary-subtle-text">
        {ratingTrendSummary(weeks)}
      </p>
    </div>
  )
}
