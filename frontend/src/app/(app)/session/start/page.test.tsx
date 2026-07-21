import { describe, it, expect, vi } from 'vitest'
import { StrictMode } from 'react'
import { render, waitFor } from '@/test/utils'
import StartSessionPage from './page'

const { mockStartPractice, mockReplace } = vi.hoisted(() => ({
  mockStartPractice: vi.fn().mockResolvedValue({ id: 42 }),
  mockReplace: vi.fn(),
}))

vi.mock('@/lib/useApi', () => ({
  useApi: () => ({ startPractice: mockStartPractice }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () =>
    new URLSearchParams('instrument=1&template=2&session=3'),
}))

describe('StartSessionPage', () => {
  it('starts the session exactly once, even under a StrictMode double-invoke', async () => {
    // StrictMode double-invokes effects in dev — without the run-once guard
    // this would call startPractice twice and orphan a duplicate session.
    render(
      <StrictMode>
        <StartSessionPage />
      </StrictMode>,
    )

    await waitFor(() => expect(mockStartPractice).toHaveBeenCalled())
    expect(mockStartPractice).toHaveBeenCalledTimes(1)
    expect(mockStartPractice).toHaveBeenCalledWith({
      instrument_id: 1,
      template_id: 2,
      template_session_id: 3,
    })
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('/session/42'),
    )
  })
})
