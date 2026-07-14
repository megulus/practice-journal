import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, userEvent } from '@/test/utils'
import { SessionNotes } from './SessionNotes'

const { mockUpdatePractice } = vi.hoisted(() => ({
  mockUpdatePractice: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/useApi', () => ({
  useApi: () => ({ updatePractice: mockUpdatePractice }),
}))

function makeFlushRef() {
  return { current: new Set<() => Promise<void>>() }
}

describe('SessionNotes', () => {
  beforeEach(() => {
    mockUpdatePractice.mockClear()
  })

  it('registers a flush once the notes diverge from the initial value', async () => {
    const flushRef = makeFlushRef()
    const user = userEvent.setup()
    render(
      <SessionNotes logId={3} initialNotes="" pendingFlushes={flushRef} />
    )

    await user.type(screen.getByPlaceholderText(/^Notes —/), 'good session')
    expect(flushRef.current.size).toBe(1)
  })

  it('saves the notes on blur', async () => {
    const user = userEvent.setup()
    render(
      <SessionNotes logId={3} initialNotes="" pendingFlushes={makeFlushRef()} />
    )

    const field = screen.getByPlaceholderText(/^Notes —/)
    await user.type(field, 'good session')
    await user.tab()

    expect(mockUpdatePractice).toHaveBeenCalledWith(3, { notes: 'good session' })
  })
})
