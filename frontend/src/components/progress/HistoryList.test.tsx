import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from 'react'
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

    await user.click(screen.getByRole('radio', { name: 'Last 7 days' }))
    await waitFor(() =>
      expect(mockGetHistory).toHaveBeenLastCalledWith({
        instrumentId: 1,
        period: 'last_7_days',
      }),
    )
    expect(screen.getByRole('radio', { name: 'Last 7 days' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(screen.getByRole('radio', { name: 'All sessions' })).toHaveAttribute(
      'aria-checked',
      'false',
    )

    await user.click(screen.getByRole('radio', { name: 'Last 30 days' }))
    await waitFor(() =>
      expect(mockGetHistory).toHaveBeenLastCalledWith({
        instrumentId: 1,
        period: 'last_30_days',
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
    await user.click(screen.getByRole('radio', { name: 'Last 7 days' }))

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

  it('keeps the loaded list when a "Load more" fetch fails', async () => {
    const user = userEvent.setup()
    mockGetHistory.mockResolvedValueOnce(
      page([makeItem({ id: 1, session_name: 'First page' })], 'cursor-2'),
    )
    render(<HistoryList instrumentId={1} />)
    await screen.findByText('First page')

    mockGetHistory.mockRejectedValueOnce(new Error('page 2 exploded'))
    await user.click(screen.getByRole('button', { name: 'Load more' }))

    // The failure is reported inline; it must not take the list down with it.
    expect(await screen.findByRole('alert')).toHaveTextContent('page 2 exploded')
    expect(screen.getByText('First page')).toBeInTheDocument()
    expect(screen.queryByText('No sessions yet.')).not.toBeInTheDocument()

    // Retrying resumes from the same cursor rather than restarting at page 1.
    mockGetHistory.mockResolvedValueOnce(
      page([makeItem({ id: 2, session_name: 'Second page' })], null),
    )
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Second page')).toBeInTheDocument()
    expect(screen.getByText('First page')).toBeInTheDocument()
    expect(mockGetHistory).toHaveBeenLastCalledWith({
      instrumentId: 1,
      period: 'all',
      cursor: 'cursor-2',
    })
  })

  it('drops an in-flight page when the instrument changes underneath it', async () => {
    const user = userEvent.setup()
    mockGetHistory.mockResolvedValueOnce(
      page([makeItem({ id: 1, session_name: 'Violin session' })], 'cursor-2'),
    )
    const { rerender } = render(<HistoryList instrumentId={1} />)
    await screen.findByText('Violin session')

    // Page 2 for the violin is still in flight when the user switches
    // instruments; its result must not be spliced into the viola's list.
    let resolvePageTwo: (value: HistoryResponse) => void = () => {}
    mockGetHistory.mockImplementationOnce(
      () => new Promise<HistoryResponse>((res) => { resolvePageTwo = res }),
    )
    await user.click(screen.getByRole('button', { name: 'Load more' }))

    mockGetHistory.mockResolvedValueOnce(
      page([makeItem({ id: 9, session_name: 'Viola session' })], null),
    )
    rerender(<HistoryList instrumentId={2} />)
    await screen.findByText('Viola session')

    // Flush the resolution and any render it causes *before* asserting.
    // `waitFor` on an absence assertion is useless here — it would pass on its
    // first poll, before the stale append could even land.
    await act(async () => {
      resolvePageTwo(
        page([makeItem({ id: 2, session_name: 'Stale violin page' })]),
      )
      await new Promise((r) => setTimeout(r, 0))
    })

    expect(screen.queryByText('Stale violin page')).not.toBeInTheDocument()
    expect(screen.getByText('Viola session')).toBeInTheDocument()
    expect(screen.queryByText('Violin session')).not.toBeInTheDocument()
  })

  it('leaves paging usable after a page fetch is superseded', async () => {
    const user = userEvent.setup()
    mockGetHistory.mockResolvedValueOnce(
      page([makeItem({ id: 1, session_name: 'Violin session' })], 'cursor-2'),
    )
    const { rerender } = render(<HistoryList instrumentId={1} />)
    await screen.findByText('Violin session')

    let resolvePageTwo: (value: HistoryResponse) => void = () => {}
    mockGetHistory.mockImplementationOnce(
      () => new Promise<HistoryResponse>((res) => { resolvePageTwo = res }),
    )
    await user.click(screen.getByRole('button', { name: 'Load more' }))

    mockGetHistory.mockResolvedValueOnce(
      page([makeItem({ id: 9, session_name: 'Viola session' })], 'cursor-9'),
    )
    rerender(<HistoryList instrumentId={2} />)
    await screen.findByText('Viola session')

    await act(async () => {
      resolvePageTwo(page([makeItem({ id: 2, session_name: 'Stale' })]))
      await new Promise((r) => setTimeout(r, 0))
    })

    // The superseded fetch must release the button. Gating its teardown on the
    // generation would strand it disabled at "Loading…" with nothing to clear
    // it, killing paging for the new instrument until remount.
    const loadMoreButton = screen.getByRole('button', { name: 'Load more' })
    expect(loadMoreButton).toBeEnabled()

    mockGetHistory.mockResolvedValueOnce(
      page([makeItem({ id: 10, session_name: 'Viola page two' })], null),
    )
    await user.click(loadMoreButton)
    expect(await screen.findByText('Viola page two')).toBeInTheDocument()
  })

  it('moves through the time-range filter with the arrow keys', async () => {
    const user = userEvent.setup()
    mockGetHistory.mockResolvedValue(page([makeItem()]))
    render(<HistoryList instrumentId={1} />)
    await screen.findByText('Technique focus')

    // One tab stop on the checked option, arrows move and select from there.
    screen.getByRole('radio', { name: 'All sessions' }).focus()
    await user.keyboard('{ArrowRight}')

    expect(screen.getByRole('radio', { name: 'Last 7 days' })).toHaveFocus()
    await waitFor(() =>
      expect(mockGetHistory).toHaveBeenLastCalledWith({
        instrumentId: 1,
        period: 'last_7_days',
      }),
    )
  })

  it('keeps the selected time range when the instrument changes', async () => {
    const user = userEvent.setup()
    mockGetHistory.mockResolvedValue(page([makeItem()]))
    const { rerender } = render(<HistoryList instrumentId={1} />)
    await screen.findByText('Technique focus')

    await user.click(screen.getByRole('radio', { name: 'Last 30 days' }))
    await waitFor(() =>
      expect(mockGetHistory).toHaveBeenLastCalledWith({
        instrumentId: 1,
        period: 'last_30_days',
      }),
    )

    rerender(<HistoryList instrumentId={2} />)
    await waitFor(() =>
      expect(mockGetHistory).toHaveBeenLastCalledWith({
        instrumentId: 2,
        period: 'last_30_days',
      }),
    )
    expect(screen.getByRole('radio', { name: 'Last 30 days' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })
})
