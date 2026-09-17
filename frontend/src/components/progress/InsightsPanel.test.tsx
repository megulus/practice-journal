import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, userEvent, waitFor } from '@/test/utils'
import { InsightsPanel } from './InsightsPanel'
import { localYear } from './heatmapGrid'
import type {
  ComparisonResponse,
  DailyMinutes,
  RatingsResponse,
  UserSettings,
  WeekStart,
} from '@/lib/types'

const {
  mockGetHeatmap,
  mockGetComparison,
  mockGetRatings,
  mockGetSettings,
  mockApi,
} = vi.hoisted(() => {
  const mockGetHeatmap = vi.fn()
  const mockGetComparison = vi.fn()
  const mockGetRatings = vi.fn()
  const mockGetSettings = vi.fn()
  // Stable identity, like the real memoized useApi — a fresh object per
  // render would retrigger the load effect forever.
  return {
    mockGetHeatmap,
    mockGetComparison,
    mockGetRatings,
    mockGetSettings,
    mockApi: {
      getHeatmap: mockGetHeatmap,
      getComparison: mockGetComparison,
      getRatings: mockGetRatings,
      getSettings: mockGetSettings,
    },
  }
})

vi.mock('@/lib/useApi', () => ({ useApi: () => mockApi }))

const DAYS = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
] as const

function emptyDaily(): DailyMinutes[] {
  return DAYS.map((day) => ({ day, minutes: 0 }))
}

function comparison(thisMinutes = 0, lastMinutes = 0): ComparisonResponse {
  return {
    this_week: {
      days_practiced: thisMinutes > 0 ? 1 : 0,
      total_minutes: thisMinutes,
      daily: emptyDaily().map((d) =>
        d.day === 'monday' ? { ...d, minutes: thisMinutes } : d,
      ),
    },
    last_week: {
      days_practiced: lastMinutes > 0 ? 1 : 0,
      total_minutes: lastMinutes,
      daily: emptyDaily().map((d) =>
        d.day === 'monday' ? { ...d, minutes: lastMinutes } : d,
      ),
    },
    delta_days: (thisMinutes > 0 ? 1 : 0) - (lastMinutes > 0 ? 1 : 0),
    delta_minutes: thisMinutes - lastMinutes,
  }
}

function settings(weekStartsOn: WeekStart = 'monday'): UserSettings {
  return {
    suggestions_preference: 'all',
    default_session_duration_minutes: 30,
    week_starts_on: weekStartsOn,
  }
}

const NO_RATINGS: RatingsResponse = {
  weeks: [
    { week_start: '2026-07-20', step_forward: 0, steady: 0, step_back: 0, total: 0 },
  ],
}

/** Nothing in any of the three chart windows — the #287 starting point. */
function resolveEmptyWindows() {
  mockGetHeatmap.mockResolvedValue({ year: 2026, days: [] })
  mockGetComparison.mockResolvedValue(comparison())
  mockGetRatings.mockResolvedValue(NO_RATINGS)
  mockGetSettings.mockResolvedValue(settings())
}

function resolveAll() {
  mockGetHeatmap.mockResolvedValue({
    year: 2026,
    days: [{ date: '2026-07-20', duration_minutes: 45 }],
  })
  mockGetComparison.mockResolvedValue(comparison(45, 30))
  mockGetRatings.mockResolvedValue({
    weeks: [
      { week_start: '2026-07-20', step_forward: 3, steady: 1, step_back: 1, total: 5 },
    ],
  })
  mockGetSettings.mockResolvedValue(settings())
}

function dayLabelRow(): string[] {
  return Array.from(screen.getByTestId('heatmap-day-labels').children).map(
    (el) => el.textContent ?? '',
  )
}

describe('InsightsPanel', () => {
  beforeEach(() => {
    mockGetHeatmap.mockReset()
    mockGetComparison.mockReset()
    mockGetRatings.mockReset()
    mockGetSettings.mockReset().mockResolvedValue(settings())
  })

  it('renders all three insights for the instrument', async () => {
    resolveAll()
    render(<InsightsPanel instrumentId={7} lastPracticedAt={null} />)

    expect(
      await screen.findByRole('heading', { name: 'Practice calendar' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'This week vs. last' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: "How it's going" }),
    ).toBeInTheDocument()

    // Pins that the panel asks for a year at all, and which one it sources it
    // from. That it must be the *local* year is pinned by localYear's own test
    // — the runner's timezone is UTC, so an assertion here couldn't tell.
    expect(mockGetHeatmap).toHaveBeenCalledWith(7, localYear())
    expect(mockGetComparison).toHaveBeenCalledWith(7)
    expect(mockGetRatings).toHaveBeenCalledWith(7, 4)
  })

  it('anchors the heatmap grid to the week_starts_on preference', async () => {
    // The whole point of #300: the grid's week boundary has to come from the
    // same setting the comparison and rating-trend charts below it use, which
    // means settings is part of this panel's load, not a Monday-first constant.
    resolveAll()
    mockGetSettings.mockResolvedValue(settings('sunday'))
    render(<InsightsPanel instrumentId={7} lastPracticedAt={null} />)

    await screen.findByRole('heading', { name: 'Practice calendar' })
    expect(mockGetSettings).toHaveBeenCalled()
    expect(dayLabelRow()).toEqual(['', 'Mon', '', 'Wed', '', 'Fri', ''])
  })

  it('leaves the grid Monday-first on the default preference', async () => {
    resolveAll()
    render(<InsightsPanel instrumentId={7} lastPracticedAt={null} />)

    await screen.findByRole('heading', { name: 'Practice calendar' })
    expect(dayLabelRow()).toEqual(['Mon', '', 'Wed', '', 'Fri', '', ''])
  })

  it('refetches when the instrument changes', async () => {
    resolveAll()
    const { rerender } = render(<InsightsPanel instrumentId={7} lastPracticedAt={null} />)
    await screen.findByRole('heading', { name: 'Practice calendar' })

    rerender(<InsightsPanel instrumentId={8} lastPracticedAt={null} />)
    await waitFor(() => expect(mockGetHeatmap).toHaveBeenLastCalledWith(8, localYear()))
    expect(mockGetComparison).toHaveBeenLastCalledWith(8)
    expect(mockGetRatings).toHaveBeenLastCalledWith(8, 4)
  })

  it('shows one first-run state rather than three blank charts', async () => {
    resolveEmptyWindows()
    render(<InsightsPanel instrumentId={7} lastPracticedAt={null} />)

    expect(
      await screen.findByText('Your first session starts the picture.'),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Practice calendar' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Start practicing' }),
    ).toBeInTheDocument()
  })

  it('charts a lapsed user rather than telling them they never practiced', async () => {
    // #287: every window signal is recency-scoped, so a user returning from a
    // break looks identical to a brand-new one. `last_practiced_at` is the
    // un-windowed tiebreak — with it set, the charts render with the gap
    // visible and nothing claims there is no history.
    resolveEmptyWindows()
    render(<InsightsPanel instrumentId={7} lastPracticedAt="2025-12-18" />)

    expect(
      await screen.findByRole('heading', { name: 'Practice calendar' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'This week vs. last' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: "How it's going" }),
    ).toBeInTheDocument()

    expect(
      screen.queryByText('Your first session starts the picture.'),
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/Nothing to chart yet/)).not.toBeInTheDocument()
  })

  it('names the gap above a lapsed user\u2019s charts', async () => {
    resolveEmptyWindows()
    render(<InsightsPanel instrumentId={7} lastPracticedAt="2025-12-18" />)

    expect(
      await screen.findByText(
        'Nothing in the last few weeks \u2014 the practice before that is still here.',
      ),
    ).toBeInTheDocument()
    // The date is the acknowledgement — a bare "some time ago" would be the
    // same denial in softer words.
    expect(
      screen.getByText(/Last session on this instrument: Dec 18, 2025\./),
    ).toBeInTheDocument()
  })

  it('leaves the gap note off when the windows have data', async () => {
    resolveAll()
    render(<InsightsPanel instrumentId={7} lastPracticedAt="2026-07-20" />)

    await screen.findByRole('heading', { name: 'Practice calendar' })
    expect(
      screen.queryByText(/the practice before that is still here/),
    ).not.toBeInTheDocument()
  })

  it('charts a week with ratings but no logged minutes this year', async () => {
    // Ratings on their own are enough to be worth showing.
    mockGetHeatmap.mockResolvedValue({ year: 2026, days: [] })
    mockGetComparison.mockResolvedValue(comparison())
    mockGetRatings.mockResolvedValue({
      weeks: [
        { week_start: '2026-07-20', step_forward: 2, steady: 0, step_back: 0, total: 2 },
      ],
    })
    render(<InsightsPanel instrumentId={7} lastPracticedAt={null} />)

    expect(
      await screen.findByRole('heading', { name: "How it's going" }),
    ).toBeInTheDocument()
  })

  it('surfaces one error with a retry when a request fails', async () => {
    const user = userEvent.setup()
    mockGetHeatmap.mockRejectedValueOnce(new Error('offline'))
    mockGetComparison.mockResolvedValue(comparison(45, 30))
    mockGetRatings.mockResolvedValue(NO_RATINGS)
    render(<InsightsPanel instrumentId={7} lastPracticedAt={null} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('offline')
    expect(
      screen.queryByRole('heading', { name: 'This week vs. last' }),
    ).not.toBeInTheDocument()

    resolveAll()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(
      await screen.findByRole('heading', { name: 'Practice calendar' }),
    ).toBeInTheDocument()
  })

  it('ignores a slow response for an instrument the user already left', async () => {
    // Instrument 7's heatmap resolves only after we've switched to 8. Without
    // a generation guard it repaints 7's charts over 8's and nothing refetches.
    let resolveSeven: (v: unknown) => void = () => {}
    mockGetHeatmap.mockImplementation((id: number) =>
      id === 7
        ? new Promise((res) => {
            resolveSeven = res
          })
        : Promise.resolve({
            year: 2026,
            days: [{ date: '2026-07-20', duration_minutes: 90 }],
          }),
    )
    mockGetComparison.mockResolvedValue(comparison(45, 30))
    mockGetRatings.mockResolvedValue({
      weeks: [
        { week_start: '2026-07-20', step_forward: 3, steady: 1, step_back: 1, total: 5 },
      ],
    })

    const { rerender } = render(<InsightsPanel instrumentId={7} lastPracticedAt={null} />)
    rerender(<InsightsPanel instrumentId={8} lastPracticedAt={null} />)
    await screen.findByRole('heading', { name: 'Practice calendar' })
    expect(
      screen.getByText('1 day practiced in 2026, 1 hr 30 min total.'),
    ).toBeInTheDocument()

    resolveSeven({ year: 2020, days: [{ date: '2020-01-06', duration_minutes: 5 }] })
    await waitFor(() =>
      expect(
        screen.getByText('1 day practiced in 2026, 1 hr 30 min total.'),
      ).toBeInTheDocument(),
    )
    expect(screen.queryByText(/2020/)).not.toBeInTheDocument()
  })

  it('ignores a stale rejection instead of erroring over a loaded panel', async () => {
    let rejectSeven: (e: unknown) => void = () => {}
    mockGetHeatmap.mockImplementation((id: number) =>
      id === 7
        ? new Promise((_res, rej) => {
            rejectSeven = rej
          })
        : Promise.resolve({
            year: 2026,
            days: [{ date: '2026-07-20', duration_minutes: 90 }],
          }),
    )
    mockGetComparison.mockResolvedValue(comparison(45, 30))
    mockGetRatings.mockResolvedValue({
      weeks: [
        { week_start: '2026-07-20', step_forward: 3, steady: 1, step_back: 1, total: 5 },
      ],
    })

    const { rerender } = render(<InsightsPanel instrumentId={7} lastPracticedAt={null} />)
    rerender(<InsightsPanel instrumentId={8} lastPracticedAt={null} />)
    await screen.findByRole('heading', { name: 'Practice calendar' })

    rejectSeven(new Error('offline'))
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Practice calendar' }),
      ).toBeInTheDocument(),
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does not call the API without an instrument', async () => {
    render(<InsightsPanel instrumentId={null} lastPracticedAt={null} />)

    await waitFor(() => expect(screen.queryByText('Loading…')).not.toBeInTheDocument())
    expect(mockGetHeatmap).not.toHaveBeenCalled()
  })
})
