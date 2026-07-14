import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, userEvent, waitFor, within } from '@/test/utils'
import ActiveSessionPage from './page'
import type { PracticeLog } from '@/lib/types'

const { mockGetPractice, mockUpdatePractice, mockPush } = vi.hoisted(() => ({
  mockGetPractice: vi.fn(),
  mockUpdatePractice: vi.fn().mockResolvedValue(undefined),
  mockPush: vi.fn(),
}))

vi.mock('@/lib/useApi', () => ({
  useApi: () => ({
    getPractice: mockGetPractice,
    updatePractice: mockUpdatePractice,
    finishPractice: vi.fn(),
  }),
}))

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '1' }),
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
}))

const baseLog: PracticeLog = {
  id: 1,
  user_id: 1,
  instrument_id: 1,
  template_id: null,
  template_session_id: null,
  status: 'in_progress',
  practice_date: '2026-07-14',
  total_duration_minutes: 0,
  notes: null,
  reflection_prompt: null,
  reflection_response: null,
  created_at: '2026-07-14T00:00:00',
  instrument_name: 'Violin',
  template_name: null,
  session_name: 'Morning practice',
  section_logs: [],
}

describe('ActiveSessionPage — End session', () => {
  beforeEach(() => {
    mockGetPractice.mockResolvedValue(baseLog)
    mockUpdatePractice.mockClear()
    mockPush.mockClear()
  })

  it('opens a confirmation dialog instead of a native confirm', async () => {
    const user = userEvent.setup()
    render(<ActiveSessionPage />)

    await screen.findByText('Morning practice')
    await user.click(screen.getByRole('button', { name: 'End session' }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('End this session?')
  })

  it('abandons the session and navigates away on confirm', async () => {
    const user = userEvent.setup()
    render(<ActiveSessionPage />)

    await screen.findByText('Morning practice')
    await user.click(screen.getByRole('button', { name: 'End session' }))

    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'End session' }))

    await waitFor(() =>
      expect(mockUpdatePractice).toHaveBeenCalledWith(1, { status: 'abandoned' })
    )
    expect(mockPush).toHaveBeenCalledWith('/today')
  })

  it('dismisses without abandoning when the user keeps going', async () => {
    const user = userEvent.setup()
    render(<ActiveSessionPage />)

    await screen.findByText('Morning practice')
    await user.click(screen.getByRole('button', { name: 'End session' }))
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: 'Keep going' }))

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
    expect(mockUpdatePractice).not.toHaveBeenCalled()
  })
})
