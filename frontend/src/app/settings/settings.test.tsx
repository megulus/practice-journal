import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, userEvent, waitFor } from '@/test/utils'
import SettingsPage from './page'

// Mock useApi to return controlled API methods
const mockGetSettings = vi.fn()
const mockUpdateSettings = vi.fn()

vi.mock('@/lib/useApi', () => ({
  useApi: () => ({
    getSettings: mockGetSettings,
    updateSettings: mockUpdateSettings,
  }),
}))

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading state initially', () => {
    mockGetSettings.mockReturnValue(new Promise(() => {})) // never resolves
    render(<SettingsPage />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('renders settings after loading', async () => {
    mockGetSettings.mockResolvedValue({ suggestions_enabled: true })
    render(<SettingsPage />)

    await waitFor(() => {
      expect(screen.getByText('Practice suggestions')).toBeInTheDocument()
    })
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  })

  it('toggles suggestions setting', async () => {
    mockGetSettings.mockResolvedValue({ suggestions_enabled: true })
    mockUpdateSettings.mockResolvedValue({ suggestions_enabled: false })
    const user = userEvent.setup()

    render(<SettingsPage />)
    await waitFor(() => {
      expect(screen.getByRole('switch')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('switch'))
    expect(mockUpdateSettings).toHaveBeenCalledWith({ suggestions_enabled: false })
  })

  it('shows error state when fetch fails', async () => {
    mockGetSettings.mockRejectedValue(new Error('Network error'))
    render(<SettingsPage />)

    await waitFor(() => {
      expect(screen.getByText(/Network error/)).toBeInTheDocument()
    })
  })
})
