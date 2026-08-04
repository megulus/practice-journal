import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, userEvent, waitFor } from '@/test/utils'
import { ProfileSettings } from './ProfileSettings'
import type { UserSettings } from '@/lib/types'

const { mockGet, mockUpdate, mockApi } = vi.hoisted(() => {
  const mockGet = vi.fn()
  const mockUpdate = vi.fn()
  // Stable identity, like the real memoized useApi — otherwise the load
  // effect re-runs on every render and stomps the state under test.
  return { mockGet, mockUpdate, mockApi: { getSettings: mockGet, updateSettings: mockUpdate } }
})

vi.mock('@/lib/useApi', () => ({ useApi: () => mockApi }))

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({ theme: 'system', resolvedTheme: 'light', setTheme: vi.fn() }),
}))

const SETTINGS: UserSettings = {
  suggestions_preference: 'all',
  default_session_duration_minutes: 30,
  week_starts_on: 'monday',
}

describe('ProfileSettings', () => {
  beforeEach(() => {
    mockGet.mockReset().mockResolvedValue(SETTINGS)
    mockUpdate.mockReset().mockImplementation(async (patch) => ({
      ...SETTINGS,
      ...patch,
    }))
  })

  it('reflects the saved settings', async () => {
    render(<ProfileSettings />)
    expect(
      await screen.findByRole('radio', { name: /All suggestions/ }),
    ).toBeChecked()
    expect(screen.getByRole('radio', { name: '30 min' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(screen.getByRole('radio', { name: 'Monday' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  it('saves a coaching-suggestions choice', async () => {
    const user = userEvent.setup()
    render(<ProfileSettings />)
    await user.click(
      await screen.findByRole('radio', { name: /Fewer suggestions/ }),
    )
    expect(mockUpdate).toHaveBeenCalledWith({ suggestions_preference: 'fewer' })
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: /Fewer/ })).toBeChecked(),
    )
  })

  it('saves the session duration and week start', async () => {
    const user = userEvent.setup()
    render(<ProfileSettings />)
    await user.click(await screen.findByRole('radio', { name: '45 min' }))
    expect(mockUpdate).toHaveBeenCalledWith({
      default_session_duration_minutes: 45,
    })

    await user.click(screen.getByRole('radio', { name: 'Sunday' }))
    expect(mockUpdate).toHaveBeenCalledWith({ week_starts_on: 'sunday' })
  })

  it('rolls back and explains when a save fails', async () => {
    mockUpdate.mockRejectedValueOnce(new Error('nope'))
    const user = userEvent.setup()
    render(<ProfileSettings />)
    await user.click(await screen.findByRole('radio', { name: /Off/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/save/i)
    // Rolled back to the server's value.
    expect(screen.getByRole('radio', { name: /All suggestions/ })).toBeChecked()
  })

  it('reports a load failure', async () => {
    mockGet.mockRejectedValueOnce(new Error('nope'))
    render(<ProfileSettings />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/load/i)
  })
})
