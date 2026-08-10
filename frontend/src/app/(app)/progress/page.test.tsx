import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, userEvent, waitFor } from '@/test/utils'
import ProgressPage from './page'
import type { Instrument } from '@/lib/types'

const {
  mockListInstruments,
  mockGetHistory,
  mockGetHeatmap,
  mockGetComparison,
  mockGetRatings,
  mockApi,
} = vi.hoisted(() => {
  const mockListInstruments = vi.fn()
  const mockGetHistory = vi.fn()
  const mockGetHeatmap = vi.fn()
  const mockGetComparison = vi.fn()
  const mockGetRatings = vi.fn()
  // Stable identity, like the real memoized useApi — a fresh object per render
  // would retrigger the load effects forever.
  return {
    mockListInstruments,
    mockGetHistory,
    mockGetHeatmap,
    mockGetComparison,
    mockGetRatings,
    mockApi: {
      listInstruments: mockListInstruments,
      getHistory: mockGetHistory,
      getHistoryDetail: vi.fn(),
      getHeatmap: mockGetHeatmap,
      getComparison: mockGetComparison,
      getRatings: mockGetRatings,
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
    expect(mockGetHeatmap).toHaveBeenCalledWith(1, new Date().getFullYear())
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
    await waitFor(() => expect(mockGetHeatmap).toHaveBeenLastCalledWith(2, new Date().getFullYear()))
    expect(mockGetComparison).toHaveBeenLastCalledWith(2)
    expect(mockGetRatings).toHaveBeenLastCalledWith(2, 4)
  })

  it('gives the panel a tab stop only when it has no focusable content', async () => {
    const user = userEvent.setup()
    mockListInstruments.mockResolvedValue([makeInstrument()])
    render(<ProgressPage />)

    // History renders the time-range pills in every state, so it's already
    // keyboard-reachable — an extra tab stop would just be a redundant one.
    await screen.findByRole('tab', { name: 'History' })
    expect(screen.getByRole('tabpanel')).not.toHaveAttribute('tabindex')

    // The Insights charts are all static — no control to tab to — so without
    // a tab stop the panel's content would be unreachable from the keyboard.
    await user.click(screen.getByRole('tab', { name: 'Insights' }))
    await screen.findByRole('heading', { name: 'Practice calendar' })
    expect(screen.getByRole('tabpanel')).toHaveAttribute('tabindex', '0')
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
