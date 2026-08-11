import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/utils'
import { WeekComparison } from './WeekComparison'
import type { ComparisonResponse, DailyMinutes, WeekStats } from '@/lib/types'

const DAYS = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
] as const

function weekStats(minutes: Partial<Record<(typeof DAYS)[number], number>>): WeekStats {
  const daily: DailyMinutes[] = DAYS.map((day) => ({
    day,
    minutes: minutes[day] ?? 0,
  }))
  return {
    days_practiced: daily.filter((d) => d.minutes > 0).length,
    total_minutes: daily.reduce((sum, d) => sum + d.minutes, 0),
    daily,
  }
}

function comparison(
  thisWeek: Partial<Record<(typeof DAYS)[number], number>>,
  lastWeek: Partial<Record<(typeof DAYS)[number], number>>,
): ComparisonResponse {
  const this_week = weekStats(thisWeek)
  const last_week = weekStats(lastWeek)
  return {
    this_week,
    last_week,
    delta_days: this_week.days_practiced - last_week.days_practiced,
    delta_minutes: this_week.total_minutes - last_week.total_minutes,
  }
}

describe('WeekComparison', () => {
  it('shows days practiced and total time for both weeks', () => {
    render(
      <WeekComparison
        data={comparison(
          { monday: 30, tuesday: 20, wednesday: 42, thursday: 10 },
          { monday: 30, wednesday: 25, friday: 20 },
        )}
      />,
    )

    expect(screen.getByText('4 days')).toBeInTheDocument()
    expect(screen.getByText('1 hr 42 min total')).toBeInTheDocument()

    expect(screen.getByText('3 days')).toBeInTheDocument()
    expect(screen.getByText('1 hr 15 min total')).toBeInTheDocument()
  })

  it('states the day delta against last week', () => {
    render(<WeekComparison data={comparison({ monday: 30 }, {})} />)
    expect(screen.getByText('+1 day vs. last week')).toBeInTheDocument()
  })

  it('does not hide a down week', () => {
    render(
      <WeekComparison data={comparison({}, { monday: 30, tuesday: 30 })} />,
    )
    expect(screen.getByText('−2 days vs. last week')).toBeInTheDocument()
  })

  it('says when the two weeks match', () => {
    render(<WeekComparison data={comparison({ monday: 30 }, { friday: 10 })} />)
    expect(screen.getByText('Same as last week')).toBeInTheDocument()
  })

  it('singularizes a one-day week', () => {
    render(<WeekComparison data={comparison({ monday: 30 }, {})} />)
    expect(screen.getByText('1 day')).toBeInTheDocument()
    expect(screen.getByText('0 days')).toBeInTheDocument()
  })

  it('scales the paired bars against the tallest day across both weeks', () => {
    render(
      <WeekComparison
        data={comparison({ monday: 60, tuesday: 30 }, { monday: 15 })}
      />,
    )

    const tallest = screen.getByTestId('bar-this-monday')
    const half = screen.getByTestId('bar-this-tuesday')
    const quarter = screen.getByTestId('bar-last-monday')

    expect(tallest).toHaveStyle({ height: '64px' })
    expect(half).toHaveStyle({ height: '32px' })
    expect(quarter).toHaveStyle({ height: '16px' })
  })

  it('gives a short session a visible sliver and an unpracticed day none', () => {
    render(<WeekComparison data={comparison({ monday: 120, tuesday: 1 }, {})} />)

    // 1/120 of 64px would round to under a pixel.
    expect(screen.getByTestId('bar-this-tuesday')).toHaveStyle({ height: '3px' })
    expect(screen.getByTestId('bar-this-wednesday')).toHaveStyle({ height: '0px' })
  })

  it('describes the chart for screen readers', () => {
    render(<WeekComparison data={comparison({ monday: 30 }, { friday: 20 })} />)

    const chart = screen.getByRole('img', { name: /Daily practice minutes/ })
    expect(chart).toHaveAccessibleName(/This week: Mon 30 minutes/)
    expect(chart).toHaveAccessibleName(/Last week: .*Fri 20 minutes/)
  })

  it('labels each series in the card and again in the chart legend', () => {
    render(<WeekComparison data={comparison({}, {})} />)
    expect(screen.getAllByText('This week')).toHaveLength(2)
    expect(screen.getAllByText('Last week')).toHaveLength(2)
  })
})
