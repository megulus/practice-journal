import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from '@testing-library/react'
import { render, screen, userEvent, waitFor, within } from '@/test/utils'
import ActiveSessionPage from './page'
import type { BlockLog, PracticeLog, SectionLog } from '@/lib/types'

// One hoisted object, not a fresh one per render: the page and its children
// have `api`-dependent load effects that would otherwise loop (#277).
const { mockApi, mockPush } = vi.hoisted(() => ({
  mockApi: {
    getPractice: vi.fn(),
    updatePractice: vi.fn().mockResolvedValue(undefined),
    finishPractice: vi.fn(),
    updateBlockLog: vi.fn().mockResolvedValue(undefined),
    updateSectionLog: vi.fn().mockResolvedValue(undefined),
    addFreeformBlock: vi.fn().mockResolvedValue(undefined),
    listInstruments: vi.fn().mockResolvedValue([]),
    getInSessionSuggestions: vi.fn().mockResolvedValue({ suggestions: {} }),
  },
  mockPush: vi.fn(),
}))
const mockGetPractice = mockApi.getPractice
const mockUpdatePractice = mockApi.updatePractice

vi.mock('@/lib/useApi', () => ({ useApi: () => mockApi }))

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

function makeBlock(overrides: Partial<BlockLog> = {}): BlockLog {
  return {
    id: 1,
    block_id: null,
    spot_id: null,
    block_name: 'G major scale',
    rating: null,
    notes: null,
    completed: false,
    display_order: 0,
    tempo_bpm: null,
    last_tempo_bpm: null,
    ...overrides,
  }
}

function makeSection(overrides: Partial<SectionLog> = {}): SectionLog {
  return {
    id: 1,
    section_id: null,
    section_type: 'scales',
    section_name: 'Scales',
    planned_duration_minutes: 10,
    actual_duration_minutes: 10,
    display_order: 0,
    completed: false,
    skipped: false,
    block_logs: [makeBlock()],
    ...overrides,
  }
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

describe('ActiveSessionPage — progress label (#183)', () => {
  beforeEach(() => {
    mockGetPractice.mockReset()
    mockApi.getInSessionSuggestions.mockResolvedValue({ suggestions: {} })
  })

  it('omits the label while nothing is completed', async () => {
    mockGetPractice.mockResolvedValue({
      ...baseLog,
      section_logs: [
        makeSection({ id: 1, section_name: 'Warm-up' }),
        makeSection({ id: 2, section_name: 'Scales' }),
      ],
    })
    render(<ActiveSessionPage />)

    expect(await screen.findByText('0 of 2 sections done')).toBeInTheDocument()
  })

  it('names the completed section alongside the count', async () => {
    mockGetPractice.mockResolvedValue({
      ...baseLog,
      section_logs: [
        makeSection({
          id: 1,
          section_name: 'Warm-up',
          block_logs: [makeBlock({ id: 1, completed: true })],
        }),
        makeSection({
          id: 2,
          section_name: 'Scales',
          block_logs: [makeBlock({ id: 2, completed: true })],
        }),
        makeSection({ id: 3, section_name: 'Repertoire' }),
      ],
    })
    render(<ActiveSessionPage />)

    expect(
      await screen.findByText('2 of 3 sections done · Scales complete')
    ).toBeInTheDocument()
  })

  it('leaves an empty freeform section out of the ratio', async () => {
    mockGetPractice.mockResolvedValue({
      ...baseLog,
      section_logs: [
        makeSection({
          id: 1,
          section_name: 'Scales',
          block_logs: [makeBlock({ id: 1, completed: true })],
        }),
        // "+ Add a section" mid-session — nothing in it to complete
        makeSection({ id: 2, section_name: 'Sight-reading', block_logs: [] }),
      ],
    })
    render(<ActiveSessionPage />)

    expect(
      await screen.findByText('1 of 1 sections done · Scales complete')
    ).toBeInTheDocument()
  })

  it('says "Skipped <name>" for a skipped section', async () => {
    mockGetPractice.mockResolvedValue({
      ...baseLog,
      section_logs: [
        makeSection({ id: 1, section_name: 'warm-up', skipped: true }),
        makeSection({ id: 2, section_name: 'Scales' }),
      ],
    })
    render(<ActiveSessionPage />)

    expect(
      await screen.findByText('1 of 2 sections done · Skipped warm-up')
    ).toBeInTheDocument()
  })
})

describe('ActiveSessionPage — in-session suggestions (#180)', () => {
  beforeEach(() => {
    mockApi.getInSessionSuggestions.mockClear().mockResolvedValue({
      suggestions: {
        '1': {
          rule_id: 'note_recall',
          text: 'Last session you noted the top octave was shaky.',
        },
      },
    })
    mockApi.updateBlockLog.mockClear()
    mockGetPractice.mockReset().mockResolvedValue({
      ...baseLog,
      section_logs: [makeSection({ block_logs: [makeBlock({ id: 1 })] })],
    })
  })

  it('fetches on load and renders a hint below the matching block', async () => {
    render(<ActiveSessionPage />)

    expect(await screen.findByRole('note')).toHaveTextContent(
      'Last session you noted the top octave was shaky.'
    )
    expect(mockApi.getInSessionSuggestions).toHaveBeenCalledWith(1)
  })

  it('refetches on a debounce after a block update, not immediately', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<ActiveSessionPage />)

      await screen.findByRole('note')
      expect(mockApi.getInSessionSuggestions).toHaveBeenCalledTimes(1)

      await user.click(screen.getByRole('checkbox', { name: 'Mark complete' }))
      await waitFor(() => expect(mockApi.updateBlockLog).toHaveBeenCalled())

      // Still just the load-time fetch — the refresh is debounced.
      expect(mockApi.getInSessionSuggestions).toHaveBeenCalledTimes(1)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000)
      })
      expect(mockApi.getInSessionSuggestions).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps the session usable when the suggestions call fails', async () => {
    mockApi.getInSessionSuggestions.mockRejectedValue(new Error('boom'))
    render(<ActiveSessionPage />)

    await screen.findByText('Morning practice')
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })
})
