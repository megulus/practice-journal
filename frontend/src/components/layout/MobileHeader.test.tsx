import { describe, it, expect, vi } from 'vitest'
import { render, screen, userEvent } from '@/test/utils'
import MobileHeader from './MobileHeader'

const { mockSignOut } = vi.hoisted(() => ({ mockSignOut: vi.fn() }))
vi.mock('@/hooks/useSignOut', () => ({ useSignOut: () => mockSignOut }))

describe('MobileHeader', () => {
  it('renders the wordmark and an avatar menu trigger', () => {
    render(<MobileHeader />)
    expect(screen.getByText('Kantelo')).toBeInTheDocument()
    // Avatar is now a menu trigger (mocked user: Test User / TU).
    const trigger = screen.getByRole('button', { name: /Test User/ })
    expect(trigger).toHaveTextContent('TU')
  })

  it('opens Profile + Sign out from the avatar menu, and signs out', async () => {
    const user = userEvent.setup()
    render(<MobileHeader />)
    await user.click(screen.getByRole('button', { name: /Test User/ }))
    expect(
      await screen.findByRole('menuitem', { name: 'Profile' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }))
    expect(mockSignOut).toHaveBeenCalledOnce()
  })
})
