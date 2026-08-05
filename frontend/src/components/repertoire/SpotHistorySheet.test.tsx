import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, userEvent, within } from '@/test/utils'
import { SpotHistorySheet } from './SpotHistorySheet'
import type { Spot, SpotHistory } from '@/lib/types'

const { api, mockGetSpotHistory } = vi.hoisted(() => {
  const mockGetSpotHistory = vi.fn()
  return { mockGetSpotHistory, api: { getSpotHistory: mockGetSpotHistory } }
})

vi.mock('@/lib/useApi', () => ({ useApi: () => api }))

const SPOT: Spot = {
  id: 10,
  name: 'Coda run',
  location: 'mm. 34 to 41',
  display_order: 0,
  retired_at: null,
  session_count: 3,
  last_practiced_at: null,
}

const HISTORY: SpotHistory = {
  spot: SPOT,
  logs: [
    {
      block_log_id: 1,
      practice_date: '2026-03-20',
      rating: 1,
      notes: 'Finally clean at 92.',
      session_id: 100,
    },
    {
      block_log_id: 2,
      practice_date: '2026-03-18',
      rating: -1,
      notes: null,
      session_id: 99,
    },
  ],
  rating_trend: { step_back: 1, steady: 0, step_forward: 1, skipped: 0 },
}

describe('SpotHistorySheet', () => {
  beforeEach(() => {
    mockGetSpotHistory.mockReset().mockResolvedValue(HISTORY)
  })

  it('shows the trend tally and each logged session', async () => {
    render(<SpotHistorySheet spot={SPOT} onClose={vi.fn()} />)

    const trend = within(await screen.findByLabelText('Rating trend'))
    expect(trend.getByText('Step forward')).toBeInTheDocument()
    expect(trend.getByText('Step back')).toBeInTheDocument()
    // Ratings with no logs are left out entirely.
    expect(trend.queryByText('Steady')).not.toBeInTheDocument()

    const sessions = within(screen.getByLabelText('Logged sessions'))
    expect(sessions.getAllByRole('listitem')).toHaveLength(2)
    expect(sessions.getByText('Finally clean at 92.')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toHaveTextContent('mm. 34 to 41')
  })

  it('says so when nothing has been logged yet', async () => {
    mockGetSpotHistory.mockResolvedValue({
      spot: SPOT,
      logs: [],
      rating_trend: { step_back: 0, steady: 0, step_forward: 0, skipped: 0 },
    })
    render(<SpotHistorySheet spot={SPOT} onClose={vi.fn()} />)
    expect(
      await screen.findByText(/No practice logged for this spot yet/),
    ).toBeInTheDocument()
  })

  it('reports a load failure', async () => {
    mockGetSpotHistory.mockRejectedValue(new Error('nope'))
    render(<SpotHistorySheet spot={SPOT} onClose={vi.fn()} />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/history/i)
  })

  it('closes on Done', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<SpotHistorySheet spot={SPOT} onClose={onClose} />)
    await user.click(await screen.findByRole('button', { name: 'Done' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
