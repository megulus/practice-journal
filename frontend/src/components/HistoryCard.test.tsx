import { describe, it, expect } from 'vitest'
import { render, screen, userEvent } from '@/test/utils'
import HistoryCard from './HistoryCard'
import type { PracticeLog } from '@/lib/types'

const baseLog: PracticeLog = {
  id: 1,
  practice_date: '2026-03-01',
  duration_minutes: 45,
  notes: 'Focused on intonation',
  log_details: [
    {
      id: 1,
      log_id: 1,
      section_type: 'warm-up',
      content: 'Long tones',
      tempo_practiced: 60,
      key_practiced: 'G Major',
    },
  ],
  created_at: '2026-03-01T10:00:00Z',
}

describe('HistoryCard', () => {
  it('renders duration', () => {
    render(<HistoryCard log={baseLog} />)
    expect(screen.getByText('45 min')).toBeInTheDocument()
  })

  it('shows day title when provided', () => {
    render(<HistoryCard log={baseLog} dayTitle="Day 1" />)
    expect(screen.getByText(/Day 1/)).toBeInTheDocument()
  })

  it('expands to show notes and details on click', async () => {
    const user = userEvent.setup()
    render(<HistoryCard log={baseLog} />)

    // Details should not be visible initially
    expect(screen.queryByText('Focused on intonation')).not.toBeInTheDocument()

    // Click the card to expand
    await user.click(screen.getByText('45 min'))
    expect(screen.getByText('Focused on intonation')).toBeInTheDocument()
    expect(screen.getByText('Long tones')).toBeInTheDocument()
  })

  it('shows tempo and key in expanded detail', async () => {
    const user = userEvent.setup()
    render(<HistoryCard log={baseLog} />)
    await user.click(screen.getByText('45 min'))

    expect(screen.getByText(/♩=60/)).toBeInTheDocument()
    expect(screen.getByText(/G Major/)).toBeInTheDocument()
  })

  it('does not expand when there are no details or notes', async () => {
    const emptyLog: PracticeLog = {
      ...baseLog,
      notes: undefined,
      log_details: [],
    }
    const user = userEvent.setup()
    const { container } = render(<HistoryCard log={emptyLog} />)

    await user.click(screen.getByText('45 min'))
    // Should not show expanded content divider
    expect(container.querySelector('.border-t-2')).not.toBeInTheDocument()
  })
})
