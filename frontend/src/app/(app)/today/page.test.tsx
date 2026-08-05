import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, userEvent } from '@/test/utils'
import TodayPage from './page'
import type { Instrument, TodayResponse } from '@/lib/types'

// One stable client for the file — a per-render object would change `api`'s
// identity and re-fire the load effect forever (see #277).
const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    getToday: vi.fn(),
    listInstruments: vi.fn(),
    getPreSessionSuggestion: vi.fn(),
    dismissSuggestion: vi.fn(),
    quickStart: vi.fn(),
  },
}))

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

const PLANNED_TODAY: TodayResponse = {
  active_session: null,
  instruments_due: [
    {
      instrument: { id: 1, name: 'Violin', practice_frequency: 'daily' },
      last_practiced_at: null,
      days_since_last: null,
      current_session: {
        template_id: 3,
        template_name: 'Bruch concerto',
        session_id: 5,
        session_name: 'Session 1',
        focus_description: null,
        rotation_position: 'session 1 of 1',
        estimated_duration_minutes: 30,
        section_types: ['warmup', 'repertoire'],
      },
      repeat_session: null,
      all_sessions: [],
    },
  ],
  instruments_not_due: [],
}

const EMPTY_TODAY: TodayResponse = {
  active_session: null,
  instruments_due: [],
  instruments_not_due: [],
}

beforeEach(() => {
  mockApi.getToday.mockReset()
  mockApi.listInstruments.mockReset()
  mockApi.getPreSessionSuggestion.mockReset()
  mockApi.getPreSessionSuggestion.mockResolvedValue({ suggestion: null })
})

describe('Today tab — quick-start gating', () => {
  it('hands a brand-new user to the wizard', async () => {
    mockApi.getToday.mockResolvedValue(EMPTY_TODAY)
    mockApi.listInstruments.mockResolvedValue([])

    render(<TodayPage />)

    expect(
      await screen.findByRole('heading', { name: 'What do you play?' }),
    ).toBeInTheDocument()
  })

  it('shows the wizard when instruments exist but no plan does', async () => {
    mockApi.getToday.mockResolvedValue(EMPTY_TODAY)
    mockApi.listInstruments.mockResolvedValue([
      makeInstrument({ active_template_count: 0 }),
    ])

    render(<TodayPage />)

    expect(
      await screen.findByRole('heading', { name: 'What do you play?' }),
    ).toBeInTheDocument()
  })

  it('shows the plan card instead once a plan is active', async () => {
    mockApi.getToday.mockResolvedValue(PLANNED_TODAY)
    mockApi.listInstruments.mockResolvedValue([
      makeInstrument({ active_template_count: 1 }),
    ])

    render(<TodayPage />)

    expect(
      await screen.findByRole('heading', { name: "Today's practice" }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'What do you play?' })).toBeNull()
  })

  it('falls back to the ordinary empty state after "Skip setup"', async () => {
    const user = userEvent.setup()
    mockApi.getToday.mockResolvedValue(EMPTY_TODAY)
    mockApi.listInstruments.mockResolvedValue([])

    render(<TodayPage />)
    await user.click(await screen.findByRole('button', { name: 'Skip setup' }))

    expect(
      await screen.findByRole('heading', { name: 'Welcome to Kantelo' }),
    ).toBeInTheDocument()
  })

  it('lets the user re-open the wizard from the empty state', async () => {
    const user = userEvent.setup()
    mockApi.getToday.mockResolvedValue(EMPTY_TODAY)
    mockApi.listInstruments.mockResolvedValue([])

    render(<TodayPage />)
    await user.click(await screen.findByRole('button', { name: 'Skip setup' }))
    await user.click(await screen.findByRole('button', { name: 'Get started' }))

    expect(
      await screen.findByRole('heading', { name: 'What do you play?' }),
    ).toBeInTheDocument()
  })
})
