import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, userEvent, waitFor } from '@/test/utils'
import ProgressPage from './page'
import type { Instrument } from '@/lib/types'
import { localYear } from '@/components/progress/heatmapGrid'

const {
  mockListInstruments,
  mockGetHistory,
  mockGetHeatmap,
  mockGetComparison,
  mockGetRatings,
  mockGetSettings,
  mockApi,
} = vi.hoisted(() => {
  const mockListInstruments = vi.fn()
  const mockGetHistory = vi.fn()
  const mockGetHeatmap = vi.fn()
  const mockGetComparison = vi.fn()
  const mockGetRatings = vi.fn()
  const mockGetSettings = vi.fn()
  // Stable identity, like the real memoized useApi — a fresh object per render
  // would retrigger the load effects forever.
  return {
    mockListInstruments,
    mockGetHistory,
    mockGetHeatmap,
    mockGetComparison,
    mockGetRatings,
    mockGetSettings,
    mockApi: {
      listInstruments: mockListInstruments,
      getHistory: mockGetHistory,
      getHistoryDetail: vi.fn(),
      getHeatmap: mockGetHeatmap,
      getComparison: mockGetComparison,
      getRatings: mockGetRatings,
      getSettings: mockGetSettings,
    },
  }
})

const EMPTY_WEEK = {
  days_practiced: 0,
  total_minutes: 0,
  daily: [
    { day: 'monday' as const, minutes: 0 },
    { day: 'tuesday' as const, minutes: 0 },
    { day: 'wednesday' as const, minutes: 0 },
    { day: 'thursday' as const, minutes: 0 },
    { day: 'friday' as const, minutes: 0 },
    { day: 'saturday' as const, minutes: 0 },
    { day: 'sunday' as const, minutes: 0 },
  ],
}

vi.mock('@/lib/useApi', () => ({ useApi: () => mockApi }))

function makeInstrument(o: Partial<Instrument> = {}): Instrument {
  return {
    id: 1,
    name: 'Violin',
    instrument_category: 'violin',
    practice_frequency: 'daily',
    display_order: 0,
    active_template_count: 0,
    template_count: 0,
    piece_count: 0,
    last_practiced_at: null,
    ...o,
  }
}

describe('ProgressPage', () => {
  beforeEach(() => {
    mockListInstruments.mockReset()
    mockGetHistory.mockReset()
    mockGetHistory.mockResolvedValue({ items: [], next_cursor: null })
    mockGetHeatmap.mockReset()
    mockGetHeatmap.mockResolvedValue({
      year: 2026,
      days: [{ date: '2026-07-21', duration_minutes: 30 }],
    })
    mockGetComparison.mockReset()
    mockGetComparison.mockResolvedValue({
      this_week: EMPTY_WEEK,
      last_week: EMPTY_WEEK,
      delta_days: 0,
      delta_minutes: 0,
    })
    mockGetRatings.mockReset()
    mockGetRatings.mockResolvedValue({ weeks: [] })
    mockGetSettings.mockReset()
    mockGetSettings.mockResolvedValue({
      suggestions_preference: 'all',
      default_session_duration_minutes: 30,
      week_starts_on: 'monday',
    })
  })

  it('opens on History for the first instrument', async () => {
    mockListInstruments.mockResolvedValue([makeInstrument()])
    render(<ProgressPage />)

    expect(
      await screen.findByRole('tab', { name: 'History' }),
    ).toHaveAttribute('aria-selected', 'true')
    await waitFor(() =>
      expect(mockGetHistory).toHaveBeenCalledWith({
        instrumentId: 1,
        period: 'all',
      }),
    )
  })

  it('switches History to the instrument picked in the toggle', async () => {
    const user = userEvent.setup()
    mockListInstruments.mockResolvedValue([
      makeInstrument({ id: 1, name: 'Violin' }),
      makeInstrument({ id: 2, name: 'Viola' }),
    ])
    render(<ProgressPage />)

    await user.click(await screen.findByRole('button', { name: 'Viola' }))
    await waitFor(() =>
      expect(mockGetHistory).toHaveBeenLastCalledWith({
        instrumentId: 2,
        period: 'all',
      }),
    )
  })

  it('hides the instrument toggle for a single-instrument user', async () => {
    mockListInstruments.mockResolvedValue([makeInstrument()])
    render(<ProgressPage />)

    await screen.findByRole('tab', { name: 'History' })
    expect(screen.queryByRole('button', { name: 'Violin' })).not.toBeInTheDocument()
  })

  it('renders Insights for the selected instrument', async () => {
    const user = userEvent.setup()
    mockListInstruments.mockResolvedValue([makeInstrument()])
    render(<ProgressPage />)

    await user.click(await screen.findByRole('tab', { name: 'Insights' }))
    expect(
      await screen.findByRole('heading', { name: 'Practice calendar' }),
    ).toBeInTheDocument()
    expect(mockGetHeatmap).toHaveBeenCalledWith(1, localYear())
    expect(mockGetComparison).toHaveBeenCalledWith(1)
    expect(mockGetRatings).toHaveBeenCalledWith(1, 4)
    // History's controls are gone while Insights is showing.
    expect(
      screen.queryByRole('button', { name: 'All sessions' }),
    ).not.toBeInTheDocument()
  })

  it('switches Insights to the instrument picked in the toggle', async () => {
    const user = userEvent.setup()
    mockListInstruments.mockResolvedValue([
      makeInstrument({ id: 1, name: 'Violin' }),
      makeInstrument({ id: 2, name: 'Viola' }),
    ])
    render(<ProgressPage />)

    await user.click(await screen.findByRole('tab', { name: 'Insights' }))
    await screen.findByRole('heading', { name: 'Practice calendar' })

    await user.click(screen.getByRole('button', { name: 'Viola' }))
    await waitFor(() => expect(mockGetHeatmap).toHaveBeenLastCalledWith(2, localYear()))
    expect(mockGetComparison).toHaveBeenLastCalledWith(2)
    expect(mockGetRatings).toHaveBeenLastCalledWith(2, 4)
  })

  it("hands Insights the selected instrument's last-practiced date", async () => {
    // #287: with every chart window empty, whether this is a first-run user or
    // a returning one is only answerable from `last_practiced_at`, which lives
    // in this page's instruments array. Pins that it actually reaches down.
    const user = userEvent.setup()
    mockListInstruments.mockResolvedValue([
      makeInstrument({ last_practiced_at: '2025-12-18' }),
    ])
    mockGetHeatmap.mockResolvedValue({ year: 2026, days: [] })
    render(<ProgressPage />)

    await user.click(await screen.findByRole('tab', { name: 'Insights' }))
    expect(
      await screen.findByRole('heading', { name: 'Practice calendar' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Last session on this instrument: Dec 18, 2025/),
    ).toBeInTheDocument()
  })

  it('passes the selected instrument\u2019s date, not the first one\u2019s', async () => {
    // `instruments[0]` in place of `instruments.find(...)` would leave every
    // other assertion in this file green, and would show a lapsed note on an
    // instrument that has never been touched.
    const user = userEvent.setup()
    mockListInstruments.mockResolvedValue([
      makeInstrument({ id: 1, name: 'Violin', last_practiced_at: '2025-12-18' }),
      makeInstrument({ id: 2, name: 'Viola', last_practiced_at: null }),
    ])
    mockGetHeatmap.mockResolvedValue({ year: 2026, days: [] })
    render(<ProgressPage />)

    await user.click(await screen.findByRole('tab', { name: 'Insights' }))
    expect(
      await screen.findByText(/Last session on this instrument: Dec 18, 2025/),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Viola' }))
    expect(
      await screen.findByText('Your first session starts the picture.'),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/Last session on this instrument/),
    ).not.toBeInTheDocument()
  })

  it('still first-runs an instrument that has never been practiced', async () => {
    const user = userEvent.setup()
    mockListInstruments.mockResolvedValue([
      makeInstrument({ last_practiced_at: null }),
    ])
    mockGetHeatmap.mockResolvedValue({ year: 2026, days: [] })
    render(<ProgressPage />)

    await user.click(await screen.findByRole('tab', { name: 'Insights' }))
    expect(
      await screen.findByText('Your first session starts the picture.'),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Practice calendar' }),
    ).not.toBeInTheDocument()
  })

  it('leaves the tab stop to the panel content, which both tabs have', async () => {
    const user = userEvent.setup()
    mockListInstruments.mockResolvedValue([makeInstrument()])
    render(<ProgressPage />)

    // History renders the time-range pills in every state, so it's already
    // keyboard-reachable — an extra tab stop would just be a redundant one.
    await screen.findByRole('tab', { name: 'History' })
    expect(screen.getByRole('tabpanel')).not.toHaveAttribute('tabindex')

    // Insights is reachable through the heatmap's scroll region, which has to
    // be focusable anyway or a keyboard can't scroll the year.
    await user.click(screen.getByRole('tab', { name: 'Insights' }))
    await screen.findByRole('heading', { name: 'Practice calendar' })
    expect(screen.getByRole('tabpanel')).not.toHaveAttribute('tabindex')
    expect(screen.getByRole('img', { name: /Practice calendar/ })).toHaveAttribute(
      'tabindex',
      '0',
    )
  })

  it('points a user with no instruments at Profile', async () => {
    mockListInstruments.mockResolvedValue([])
    render(<ProgressPage />)

    expect(
      await screen.findByText(/Add an instrument to start tracking/),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to Profile' })).toBeInTheDocument()
  })

  it('offers a retry when the instrument load fails', async () => {
    const user = userEvent.setup()
    mockListInstruments.mockRejectedValueOnce(new Error('offline'))
    render(<ProgressPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('offline')

    mockListInstruments.mockResolvedValue([makeInstrument()])
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('tab', { name: 'History' })).toBeInTheDocument()
  })
})
