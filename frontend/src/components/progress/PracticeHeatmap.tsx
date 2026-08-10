'use client'

import { useEffect, useMemo, useRef } from 'react'
import { formatDuration } from '@/lib/duration'
import {
  buildHeatmapWeeks,
  heatmapCellLabel,
  heatmapScrollLeft,
  type HeatmapLevel,
} from './heatmapGrid'
import type { HeatmapDay } from '@/lib/types'

const CELL = 11
const GAP = 3
const DAY_LABEL_WIDTH = 26

/** Teal ramp, design tokens §2 ("Heatmap (Insights)"). */
const LEVEL_CLASS: Record<HeatmapLevel, string> = {
  0: 'bg-heatmap-empty',
  1: 'bg-heatmap-light',
  2: 'bg-heatmap-medium',
  3: 'bg-heatmap-dark',
  4: 'bg-heatmap-full',
}

const DAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', '']

/**
 * Practice calendar heatmap (spec §5.7, Insights #1): a GitHub-style
 * contribution grid over one calendar year. Rows are days of the week
 * (Monday first), columns are weeks, month names sit above the column that
 * holds the 1st.
 *
 * Cell intensity is practice *duration*, not a binary practiced/didn't — the
 * point is "am I showing up", with weight for the days you showed up properly.
 * A year is wider than a phone, so the grid scrolls horizontally.
 */
export function PracticeHeatmap({
  year,
  days,
}: {
  year: number
  days: HeatmapDay[]
}) {
  const weeks = useMemo(() => buildHeatmapWeeks(year, days), [year, days])
  const scroller = useRef<HTMLDivElement>(null)

  // Open on the current week rather than on January.
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    el.scrollLeft = heatmapScrollLeft(weeks, el.clientWidth, {
      cell: CELL,
      gap: GAP,
      labelWidth: DAY_LABEL_WIDTH,
    })
  }, [weeks])

  const daysPracticed = days.filter((d) => d.duration_minutes > 0).length
  const totalMinutes = days.reduce((sum, d) => sum + d.duration_minutes, 0)
  const summary =
    daysPracticed === 0
      ? `No practice logged in ${year}.`
      : `${daysPracticed} day${daysPracticed === 1 ? '' : 's'} practiced in ${year}, ${formatDuration(totalMinutes)} total.`

  return (
    <div>
      <p className="mb-2 text-xs text-text-secondary">{summary}</p>

      {/* A year is wider than the card, and a scroll region that nothing can
          focus is one a keyboard can't scroll — so this is a tab stop. It is
          also the role="img" node, collapsing 365 unreadable divs into one
          named graphic; the totals a screen reader needs are in the summary
          line right above. */}
      <div
        ref={scroller}
        tabIndex={0}
        role="img"
        aria-label={`Practice calendar for ${year}`}
        className="overflow-x-auto pb-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <div className="inline-block">
          {/* Month labels — one slot per week column, text allowed to spill
              right so a label sits over the week its month begins in. */}
          <div className="flex" style={{ gap: GAP, height: 14 }} aria-hidden="true">
            {/* Matches the sticky day-label gutter below, so the two rows line up. */}
            <div
              className="sticky left-0 z-10 flex-shrink-0 bg-card-bg"
              style={{ width: DAY_LABEL_WIDTH }}
            />
            {weeks.map((week, i) => (
              <div key={i} className="relative" style={{ width: CELL }}>
                {week.monthLabel && (
                  <span className="absolute left-0 top-0 whitespace-nowrap text-[10px] leading-none text-text-tertiary">
                    {week.monthLabel}
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="flex" style={{ gap: GAP }}>
            {/* Sticky so the weekday labels survive scrolling into the year. */}
            <div
              className="sticky left-0 z-10 flex flex-shrink-0 flex-col bg-card-bg"
              style={{ gap: GAP, width: DAY_LABEL_WIDTH }}
              aria-hidden="true"
            >
              {DAY_LABELS.map((label, i) => (
                <div
                  key={i}
                  className="text-[10px] leading-none text-text-tertiary"
                  style={{ height: CELL, lineHeight: `${CELL}px` }}
                >
                  {label}
                </div>
              ))}
            </div>

            {weeks.map((week, i) => (
              <div key={i} className="flex flex-col" style={{ gap: GAP }}>
                {week.days.map((cell, j) =>
                  cell === null || cell.future ? (
                    <div key={j} style={{ width: CELL, height: CELL }} />
                  ) : (
                    <div
                      key={j}
                      data-testid={`heatmap-cell-${cell.date}`}
                      data-level={cell.level}
                      title={heatmapCellLabel(cell)}
                      className={`rounded-sm ${LEVEL_CLASS[cell.level]}`}
                      style={{ width: CELL, height: CELL }}
                    />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-text-tertiary">
        <span>Less</span>
        {([0, 1, 2, 3, 4] as HeatmapLevel[]).map((level) => (
          <span
            key={level}
            aria-hidden="true"
            className={`rounded-sm ${LEVEL_CLASS[level]}`}
            style={{ width: CELL, height: CELL }}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  )
}
