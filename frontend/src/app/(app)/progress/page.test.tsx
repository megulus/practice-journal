import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, userEvent, waitFor } from '@/test/utils'
import ProgressPage from './page'
import type { Instrument } from '@/lib/types'

const { mockListInstruments, mockGetHistory, mockApi } = vi.hoisted(() => {
  const mockListInstruments = vi.fn()
  const mockGetHistory = vi.fn()
  // Stable identity, like the real memoized useApi — a fresh object per render
  // would retrigger the load effects forever.
  return {
    mockListInstruments,
    mockGetHistory,
    mockApi: {
      listInstruments: mockListInstruments,
      getHistory: mockGetHistory,
      getHistoryDetail: vi.fn(),
    },
  }
})

vi.mock('@/lib/useApi', () => ({ useApi: () => mockApi }))

function makeInstrument(o: Partial<Instrument> = {}): Instrument {
  return {
    id: 1,
    name: 'Violin',
    practice_frequency: 'daily',
    display_order: 0,
    active_template_count: 0,
    last_practiced_at: null,
    ...o,
  }
}

describe('ProgressPage', () => {
  beforeEach(() => {
    mockListInstruments.mockReset()
    mockGetHistory.mockReset()
    mockGetHistory.mockResolvedValue({ items: [], next_cursor: null })
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

  it('leaves Insights as the #150 placeholder', async () => {
    const user = userEvent.setup()
    mockListInstruments.mockResolvedValue([makeInstrument()])
    render(<ProgressPage />)

    await user.click(await screen.findByRole('tab', { name: 'Insights' }))
    expect(
      screen.getByRole('heading', { name: 'Insights' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Tracked in #150/)).toBeInTheDocument()
    // History's controls are gone while Insights is showing.
    expect(
      screen.queryByRole('button', { name: 'All sessions' }),
    ).not.toBeInTheDocument()
  })

  it('gives the panel a tab stop only when it has no focusable content', async () => {
    const user = userEvent.setup()
    mockListInstruments.mockResolvedValue([makeInstrument()])
    render(<ProgressPage />)

    // History renders the time-range pills in every state, so it's already
    // keyboard-reachable — an extra tab stop would just be a redundant one.
    await screen.findByRole('tab', { name: 'History' })
    expect(screen.getByRole('tabpanel')).not.toHaveAttribute('tabindex')

    // The Insights placeholder has nothing focusable, so without a tab stop
    // its content would be unreachable from the keyboard.
    await user.click(screen.getByRole('tab', { name: 'Insights' }))
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
