import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from 'react'
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
    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith({
        suggestions_preference: 'fewer',
      }),
    )
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: /Fewer/ })).toBeChecked(),
    )
  })

  it('saves the session duration and week start', async () => {
    const user = userEvent.setup()
    render(<ProfileSettings />)
    await user.click(await screen.findByRole('radio', { name: '45 min' }))
    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith({
        default_session_duration_minutes: 45,
      }),
    )

    await user.click(screen.getByRole('radio', { name: 'Sunday' }))
    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith({ week_starts_on: 'sunday' }),
    )
  })

  it('saves a duration chosen with the arrow keys', async () => {
    const user = userEvent.setup()
    render(<ProfileSettings />)
    const checked = await screen.findByRole('radio', { name: '30 min' })
    checked.focus()
    await user.keyboard('{ArrowRight}')

    expect(screen.getByRole('radio', { name: '45 min' })).toHaveFocus()
    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith({
        default_session_duration_minutes: 45,
      }),
    )
  })

  it('collapses a run of arrow presses into one PATCH of the final value', async () => {
    // Selection follows focus, so each arrow press is a change. Without the
    // debounce, arrowing across the group writes once per keystroke.
    const user = userEvent.setup()
    render(<ProfileSettings />)
    const checked = await screen.findByRole('radio', { name: '30 min' })
    checked.focus()
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}') // 45 → 60 → 15

    // The UI doesn't wait for the write.
    expect(screen.getByRole('radio', { name: '15 min' })).toHaveAttribute(
      'aria-checked',
      'true',
    )

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1))
    expect(mockUpdate).toHaveBeenCalledWith({
      default_session_duration_minutes: 15,
    })
  })

  it('merges changes to different preferences into one PATCH', async () => {
    const user = userEvent.setup()
    render(<ProfileSettings />)
    await user.click(await screen.findByRole('radio', { name: '45 min' }))
    await user.click(screen.getByRole('radio', { name: 'Sunday' }))

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1))
    expect(mockUpdate).toHaveBeenCalledWith({
      default_session_duration_minutes: 45,
      week_starts_on: 'sunday',
    })
  })

  it('flushes a queued save when the component unmounts', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<ProfileSettings />)
    await user.click(await screen.findByRole('radio', { name: '45 min' }))
    expect(mockUpdate).not.toHaveBeenCalled() // still inside the debounce

    // Navigating away mid-debounce must not drop a change the user already saw
    // applied. Flushing microtasks rather than waiting distinguishes this from
    // the debounce simply firing later: no wall clock passes here.
    unmount()
    await act(async () => {})
    expect(mockUpdate).toHaveBeenCalledWith({
      default_session_duration_minutes: 45,
    })
    expect(mockUpdate).toHaveBeenCalledTimes(1)
  })

  it('lands on the last choice when saves are toggled faster than they resolve', async () => {
    // Responses come back in reverse order: without serialization the stale
    // "45" response would win and the UI would disagree with the server.
    const resolvers: Array<() => void> = []
    mockUpdate.mockImplementation(
      (patch: Partial<UserSettings>) =>
        new Promise<UserSettings>((resolve) =>
          resolvers.push(() => resolve({ ...SETTINGS, ...patch })),
        ),
    )

    const user = userEvent.setup()
    render(<ProfileSettings />)
    // Let the first save leave the debounce before the second click, so the
    // two are separate requests rather than one coalesced one.
    await user.click(await screen.findByRole('radio', { name: '45 min' }))
    await waitFor(() => expect(resolvers).toHaveLength(1))
    await user.click(screen.getByRole('radio', { name: '60 min' }))

    // Only the first request is in flight; the second is queued behind it.
    expect(resolvers).toHaveLength(1)
    resolvers[0]()
    await waitFor(() => expect(resolvers).toHaveLength(2))
    resolvers[1]()

    await waitFor(() =>
      expect(screen.getByRole('radio', { name: '60 min' })).toHaveAttribute(
        'aria-checked',
        'true',
      ),
    )
    expect(mockUpdate).toHaveBeenCalledTimes(2)
  })

  it('does not flash an earlier response over a later change', async () => {
    // Each PATCH response is the *whole* settings document, so the duration
    // save's response still carries week_starts_on: monday — the state before
    // the Sunday click, which at that point is still sitting in the debounce.
    // Painting it would flip Sunday back for a round trip.
    const resolvers: Array<() => void> = []
    mockUpdate.mockImplementation(
      (patch: Partial<UserSettings>) =>
        new Promise<UserSettings>((resolve) =>
          resolvers.push(() => resolve({ ...SETTINGS, ...patch })),
        ),
    )

    const user = userEvent.setup()
    render(<ProfileSettings />)
    await user.click(await screen.findByRole('radio', { name: '45 min' }))
    // Wait for the duration PATCH to leave the debounce, so the Sunday click
    // lands as a separate change rather than being coalesced into it.
    await waitFor(() => expect(resolvers).toHaveLength(1))
    await user.click(screen.getByRole('radio', { name: 'Sunday' }))
    resolvers[0]() // duration response lands, carrying the pre-Sunday week

    // Waiting for the Sunday PATCH to go out gives any stale paint time to
    // land, so this is a real observation rather than a check that got in
    // first: both the optimistic Sunday and the saved 45 must still stand.
    await waitFor(() => expect(resolvers).toHaveLength(2))
    expect(screen.getByRole('radio', { name: 'Sunday' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(screen.getByRole('radio', { name: '45 min' })).toHaveAttribute(
      'aria-checked',
      'true',
    )

    resolvers[1]()
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(2))
  })

  it('resyncs from the server and explains when a save fails', async () => {
    mockUpdate.mockRejectedValueOnce(new Error('nope'))
    const user = userEvent.setup()
    render(<ProfileSettings />)
    await user.click(await screen.findByRole('radio', { name: /Off/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/save/i)
    // Re-read rather than restoring a click-time snapshot.
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('radio', { name: /All suggestions/ })).toBeChecked()
  })

  it('keeps the banner up when the failure resync also fails', async () => {
    mockUpdate.mockRejectedValueOnce(new Error('nope'))
    mockGet.mockResolvedValueOnce(SETTINGS).mockRejectedValueOnce(new Error('nope'))
    const user = userEvent.setup()
    render(<ProfileSettings />)
    await user.click(await screen.findByRole('radio', { name: /Off/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/save/i)
  })

  it('reports a load failure', async () => {
    mockGet.mockRejectedValueOnce(new Error('nope'))
    render(<ProfileSettings />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/load/i)
  })
})
