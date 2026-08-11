import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from '@testing-library/react'
import { render, screen, userEvent, waitFor } from '@/test/utils'
import { installSpeechMock, uninstallSpeechMock, dictate } from '@/test/speechMock'
import SessionSummaryPage from './page'
import type { FinishResponse } from '@/lib/types'

// Hoist ONE stable api object — a per-render mock would give `api` a new
// identity each pass and re-fire this page's load effect forever (#277).
const { mockApi } = vi.hoisted(() => ({
  mockApi: { getPractice: vi.fn(), saveReflection: vi.fn() },
}))

vi.mock('@/lib/useApi', () => ({ useApi: () => mockApi }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ id: '42' }),
}))

const SUMMARY: FinishResponse = {
  practice_log: {
    id: 42,
    user_id: 1,
    instrument_id: 1,
    template_id: null,
    template_session_id: null,
    status: 'completed',
    practice_date: '2026-08-05',
    total_duration_minutes: 45,
    notes: null,
    reflection_prompt: 'What surprised you today?',
    reflection_response: null,
    created_at: '2026-08-05T09:00:00',
    instrument_name: 'Violin',
    template_name: null,
    session_name: 'Morning practice',
    section_logs: [],
  },
  summary: {
    total_duration_minutes: 45,
    exercises_completed: 4,
    exercises_total: 5,
    day_streak: 3,
    ratings: { step_forward: 2, steady: 2, step_back: 0, skipped: 1 },
  },
  coaching_suggestion: null,
  reflection_prompt: 'What surprised you today?',
}

beforeEach(() => {
  installSpeechMock()
  mockApi.getPractice.mockReset()
  mockApi.saveReflection.mockReset().mockResolvedValue(undefined)
  sessionStorage.setItem('session-summary-42', JSON.stringify(SUMMARY))
})

afterEach(() => {
  uninstallSpeechMock()
  sessionStorage.clear()
})

const PLACEHOLDER = /^Felt more relaxed/

describe('session summary reflection voice input', () => {
  it('dictates a reflection and saves it', async () => {
    const user = userEvent.setup()
    render(<SessionSummaryPage />)

    await screen.findByText('What surprised you today?')
    await speak(user, 'the shift finally felt automatic')

    expect(screen.getByPlaceholderText(PLACEHOLDER)).toHaveValue(
      'the shift finally felt automatic',
    )

    await user.click(screen.getByRole('button', { name: 'Save reflection' }))
    expect(mockApi.saveReflection).toHaveBeenCalledExactlyOnceWith(42, {
      reflection_response: 'the shift finally felt automatic',
    })
    await waitFor(() =>
      expect(screen.getByText('Reflection saved.')).toBeInTheDocument(),
    )
  })

  it('appends dictation to text already typed, and keeps it editable', async () => {
    const user = userEvent.setup()
    render(<SessionSummaryPage />)

    await screen.findByText('What surprised you today?')
    await user.type(screen.getByPlaceholderText(PLACEHOLDER), 'bow hold')
    await speak(user, 'felt lighter')

    const field = screen.getByPlaceholderText(PLACEHOLDER)
    expect(field).toHaveValue('bow hold felt lighter')

    await user.type(field, ' than usual')
    expect(field).toHaveValue('bow hold felt lighter than usual')
  })

  it('hides the mic where the Web Speech API is unavailable', async () => {
    uninstallSpeechMock()
    render(<SessionSummaryPage />)

    await screen.findByText('What surprised you today?')
    expect(screen.queryByRole('button', { name: /dictate/i })).toBeNull()
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeInTheDocument()
  })
})

async function speak(
  user: ReturnType<typeof userEvent.setup>,
  phrase: string,
) {
  await user.click(screen.getByRole('button', { name: 'Dictate your reflection' }))
  act(() => dictate(phrase))
}
