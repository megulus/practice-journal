import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, userEvent, waitFor } from '@/test/utils'
import { HistoryList } from './HistoryList'
import type { HistoryItem, HistoryResponse } from '@/lib/types'

const { mockGetHistory, mockGetHistoryDetail, mockApi } = vi.hoisted(() => {
  const mockGetHistory = vi.fn()
  const mockGetHistoryDetail = vi.fn()
  // Stable identity, like the real memoized useApi — a fresh object per render
  // would retrigger the load effect forever.
  return {
    mockGetHistory,
    mockGetHistoryDetail,
    mockApi: { getHistory: mockGetHistory, getHistoryDetail: mockGetHistoryDetail },
  }
})

vi.mock('@/lib/useApi', () => ({ useApi: () => mockApi }))

function makeItem(o: Partial<HistoryItem> = {}): HistoryItem {
  return {
    id: 1,
    practice_date: '2026-07-21',
    instrument_name: 'Violin',
    session_name: 'Technique focus',
    template_name: 'Learn the Bruch concerto',
    rotation_label: 'session 2 of 7',
    total_duration_minutes: 22,
    exercise_count: 5,
    is_freeform: false,
    ...o,
  }
}

function page(items: HistoryItem[], next_cursor: string | null = null): HistoryResponse {
  return { items, next_cursor }
}

describe('HistoryList', () => {
  beforeEach(() => {
    mockGetHistory.mockReset()
    mockGetHistoryDetail.mockReset()
  })

  it('lists sessions newest-first with duration, exercise count and plan source', async () => {
    mockGetHistory.mockResolvedValue(
      page([
        makeItem({ id: 3, session_name: 'Slow practice on mvt. II' }),
        makeItem({
          id: 2,
          session_name: null,
          template_name: null,
          rotation_label: null,
          is_freeform: true,
          total_duration_minutes: 18,
          exercise_count: 3,
        }),
      ]),
    )
    render(<HistoryList instrumentId={1} />)

    expect(
      await screen.findByText('Slow practice on mvt. II'),
    ).toBeInTheDocument()
    expect(screen.getByText('Freeform session')).toBeInTheDocument()
    expect(
      screen.getByText('Learn the Bruch concerto · session 2 of 7'),
    ).toBeInTheDocument()
    expect(screen.getByText('Off-plan · no template')).toBeInTheDocument()
    expect(screen.getByText('22 min')).toBeInTheDocument()
    expect(screen.getByText('5 exercises')).toBeInTheDocument()
    expect(screen.getByText('3 exercises')).toBeInTheDocument()

    // The list keeps the API's reverse-chronological order.
    const titles = screen
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent)
    expect(titles).toEqual(['Slow practice on mvt. II', 'Freeform session'])
  })

  it('requests the selected instrument and refetches when it changes', async () => {
    mockGetHistory.mockResolvedValue(page([makeItem()]))
    const { rerender } = render(<HistoryList instrumentId={1} />)

    await waitFor(() =>
      expect(mockGetHistory).toHaveBeenCalledWith({
        instrumentId: 1,
        period: 'all',
      }),
    )

    rerender(<HistoryList instrumentId={2} />)
    await waitFor(() =>
      expect(mockGetHistory).toHaveBeenLastCalledWith({
        instrumentId: 2,
        period: 'all',
      }),
    )
  })

  it('refetches with the selected time range when a filter pill is clicked', async () => {
    const user = userEvent.setup()
    mockGetHistory.mockResolvedValue(page([makeItem()]))
    render(<HistoryList instrumentId={1} />)
    await screen.findByText('Technique focus')

    await user.click(screen.getByRole('button', { name: 'This week' }))
    await waitFor(() =>
      expect(mockGetHistory).toHaveBeenLastCalledWith({
        instrumentId: 1,
        period: 'week',
      }),
    )
    expect(screen.getByRole('button', { name: 'This week' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'All sessions' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )

    await user.click(screen.getByRole('button', { name: 'This month' }))
    await waitFor(() =>
      expect(mockGetHistory).toHaveBeenLastCalledWith({
        instrumentId: 1,
        period: 'month',
      }),
    )
  })

  it('shows the first-run empty state when nothing has been logged', async () => {
    mockGetHistory.mockResolvedValue(page([]))
    render(<HistoryList instrumentId={1} />)

    expect(await screen.findByText('No sessions yet.')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Start practicing' }),
    ).toBeInTheDocument()
  })

  it('distinguishes an empty time range from an empty history', async () => {
    const user = userEvent.setup()
    mockGetHistory.mockResolvedValue(page([makeItem()]))
    render(<HistoryList instrumentId={1} />)
    await screen.findByText('Technique focus')

    mockGetHistory.mockResolvedValue(page([]))
    await user.click(screen.getByRole('button', { name: 'This week' }))

    expect(
      await screen.findByText('No sessions in this time range.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('No sessions yet.')).not.toBeInTheDocument()
  })

  it('surfaces a load failure with a retry', async () => {
    const user = userEvent.setup()
    mockGetHistory.mockRejectedValueOnce(new Error('boom'))
    render(<HistoryList instrumentId={1} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('boom')

    mockGetHistory.mockResolvedValue(page([makeItem()]))
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Technique focus')).toBeInTheDocument()
  })

  it('appends the next page when loading more', async () => {
    const user = userEvent.setup()
    mockGetHistory.mockResolvedValueOnce(
      page([makeItem({ id: 1, session_name: 'First page' })], 'cursor-2'),
    )
    render(<HistoryList instrumentId={1} />)
    await screen.findByText('First page')

    mockGetHistory.mockResolvedValueOnce(
      page([makeItem({ id: 2, session_name: 'Second page' })], null),
    )
    await user.click(screen.getByRole('button', { name: 'Load more' }))

    expect(await screen.findByText('Second page')).toBeInTheDocument()
    expect(screen.getByText('First page')).toBeInTheDocument()
    expect(mockGetHistory).toHaveBeenLastCalledWith({
      instrumentId: 1,
      period: 'all',
      cursor: 'cursor-2',
    })
    // No cursor came back with the second page — the affordance goes away.
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Load more' }),
      ).not.toBeInTheDocument(),
    )
  })
})
