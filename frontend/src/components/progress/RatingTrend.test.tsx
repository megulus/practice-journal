import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/utils'
import { RatingTrend } from './RatingTrend'
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

describe('RatingTrend', () => {
  it('labels the rows most-recent-first', () => {
    render(
      <RatingTrend
        weeks={[
          week('2026-07-20', 1, 0, 0),
          week('2026-07-13', 1, 0, 0),
          week('2026-07-06', 1, 0, 0),
          week('2026-06-29', 1, 0, 0),
        ]}
      />,
    )

    expect(screen.getByText('This week')).toBeInTheDocument()
    expect(screen.getByText('Last week')).toBeInTheDocument()
    expect(screen.getByText('2 weeks ago')).toBeInTheDocument()
    expect(screen.getByText('3 weeks ago')).toBeInTheDocument()
    expect(
      screen.getByText('Rating distribution over the last 4 weeks'),
    ).toBeInTheDocument()
  })

  it('splits each bar by the rating mix', () => {
    render(<RatingTrend weeks={[week('2026-07-20', 5, 3, 2)]} />)

    expect(screen.getByTestId('segment-step_forward-2026-07-20')).toHaveStyle({
      width: '50%',
    })
    expect(screen.getByTestId('segment-steady-2026-07-20')).toHaveStyle({
      width: '30%',
    })
    expect(screen.getByTestId('segment-step_back-2026-07-20')).toHaveStyle({
      width: '20%',
    })
  })

  it('omits a rating that did not occur', () => {
    render(<RatingTrend weeks={[week('2026-07-20', 4, 0, 1)]} />)

    expect(
      screen.getByTestId('segment-step_forward-2026-07-20'),
    ).toBeInTheDocument()
    expect(
      screen.queryByTestId('segment-steady-2026-07-20'),
    ).not.toBeInTheDocument()
  })

  it('leaves an unrated week as an empty track', () => {
    render(<RatingTrend weeks={[week('2026-07-20', 0, 0, 0)]} />)

    expect(screen.getByTestId('rating-bar-2026-07-20')).toBeEmptyDOMElement()
    expect(
      screen.getByRole('img', { name: 'This week: no ratings' }),
    ).toBeInTheDocument()
  })

  it('reads the mix out for screen readers', () => {
    render(<RatingTrend weeks={[week('2026-07-20', 5, 3, 2)]} />)

    expect(
      screen.getByRole('img', {
        name: 'This week: 5 step forward, 3 steady, 2 step back',
      }),
    ).toBeInTheDocument()
  })

  it('uses the trajectory wording from the spec, not the wireframe labels', () => {
    render(<RatingTrend weeks={[week('2026-07-20', 5, 3, 2)]} />)

    expect(screen.getByText('Step forward')).toBeInTheDocument()
    expect(screen.getByText('Steady')).toBeInTheDocument()
    expect(screen.getByText('Step back')).toBeInTheDocument()
    expect(screen.queryByText('Nailed it')).not.toBeInTheDocument()
    expect(screen.queryByText('Struggled')).not.toBeInTheDocument()
  })

  it('sits a plain-language read below the chart', () => {
    render(
      <RatingTrend
        weeks={[week('2026-07-20', 8, 2, 0), week('2026-07-13', 2, 8, 0)]}
      />,
    )
    expect(screen.getByText(/Trending up/)).toBeInTheDocument()
  })

  it('singularizes a single-week window', () => {
    render(<RatingTrend weeks={[week('2026-07-20', 1, 0, 0)]} />)
    expect(
      screen.getByText('Rating distribution over the last 1 week'),
    ).toBeInTheDocument()
  })
})
