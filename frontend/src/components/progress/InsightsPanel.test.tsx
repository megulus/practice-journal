import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, userEvent, waitFor } from '@/test/utils'
import { InsightsPanel } from './InsightsPanel'
import type {
  ComparisonResponse,
  DailyMinutes,
  RatingsResponse,
} from '@/lib/types'

const { mockGetHeatmap, mockGetComparison, mockGetRatings, mockApi } =
  vi.hoisted(() => {
    const mockGetHeatmap = vi.fn()
    const mockGetComparison = vi.fn()
    const mockGetRatings = vi.fn()
    // Stable identity, like the real memoized useApi — a fresh object per
    // render would retrigger the load effect forever.
    return {
      mockGetHeatmap,
      mockGetComparison,
      mockGetRatings,
      mockApi: {
        getHeatmap: mockGetHeatmap,
        getComparison: mockGetComparison,
        getRatings: mockGetRatings,
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

const NO_RATINGS: RatingsResponse = {
  weeks: [
    { week_start: '2026-07-20', step_forward: 0, steady: 0, step_back: 0, total: 0 },
  ],
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
}

describe('InsightsPanel', () => {
  beforeEach(() => {
    mockGetHeatmap.mockReset()
    mockGetComparison.mockReset()
    mockGetRatings.mockReset()
  })

  it('renders all three insights for the instrument', async () => {
    resolveAll()
    render(<InsightsPanel instrumentId={7} />)

    expect(
      await screen.findByRole('heading', { name: 'Practice calendar' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'This week vs. last' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: "How it's going" }),
    ).toBeInTheDocument()

    expect(mockGetHeatmap).toHaveBeenCalledWith(7, new Date().getFullYear())
    expect(mockGetComparison).toHaveBeenCalledWith(7)
    expect(mockGetRatings).toHaveBeenCalledWith(7, 4)
  })

  it('refetches when the instrument changes', async () => {
    resolveAll()
    const { rerender } = render(<InsightsPanel instrumentId={7} />)
    await screen.findByRole('heading', { name: 'Practice calendar' })

    rerender(<InsightsPanel instrumentId={8} />)
    await waitFor(() => expect(mockGetHeatmap).toHaveBeenLastCalledWith(8, new Date().getFullYear()))
    expect(mockGetComparison).toHaveBeenLastCalledWith(8)
    expect(mockGetRatings).toHaveBeenLastCalledWith(8, 4)
  })

  it('shows one empty state rather than three blank charts', async () => {
    mockGetHeatmap.mockResolvedValue({ year: 2026, days: [] })
    mockGetComparison.mockResolvedValue(comparison())
    mockGetRatings.mockResolvedValue(NO_RATINGS)
    render(<InsightsPanel instrumentId={7} />)

    expect(await screen.findByText('Nothing to chart yet.')).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Practice calendar' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Start practicing' }),
    ).toBeInTheDocument()
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
    render(<InsightsPanel instrumentId={7} />)

    expect(
      await screen.findByRole('heading', { name: "How it's going" }),
    ).toBeInTheDocument()
  })

  it('surfaces one error with a retry when a request fails', async () => {
    const user = userEvent.setup()
    mockGetHeatmap.mockRejectedValueOnce(new Error('offline'))
    mockGetComparison.mockResolvedValue(comparison(45, 30))
    mockGetRatings.mockResolvedValue(NO_RATINGS)
    render(<InsightsPanel instrumentId={7} />)

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

    const { rerender } = render(<InsightsPanel instrumentId={7} />)
    rerender(<InsightsPanel instrumentId={8} />)
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

    const { rerender } = render(<InsightsPanel instrumentId={7} />)
    rerender(<InsightsPanel instrumentId={8} />)
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
    render(<InsightsPanel instrumentId={null} />)

    await waitFor(() => expect(screen.queryByText('Loading…')).not.toBeInTheDocument())
    expect(mockGetHeatmap).not.toHaveBeenCalled()
  })
})
