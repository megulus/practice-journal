import { describe, it, expect, vi } from 'vitest'
import { render, screen, userEvent } from '@/test/utils'
import SideNav from './SideNav'

const { mockSignOut } = vi.hoisted(() => ({ mockSignOut: vi.fn() }))
vi.mock('@/hooks/useSignOut', () => ({ useSignOut: () => mockSignOut }))

describe('SideNav', () => {
  it('renders the wordmark and the three primary links', () => {
    render(<SideNav />)
    expect(screen.getByText('Kantelo')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Today' })).toHaveAttribute(
      'href',
      '/today',
    )
    expect(screen.getByRole('link', { name: 'Progress' })).toHaveAttribute(
      'href',
      '/progress',
    )
    expect(screen.getByRole('link', { name: 'Plans' })).toHaveAttribute(
      'href',
      '/plans',
    )
  })

  it('exposes Profile + Sign out via the footer menu (not as a primary link)', async () => {
    const user = userEvent.setup()
    render(<SideNav />)
    // Profile is not one of the primary nav links.
    expect(screen.queryByRole('link', { name: 'Profile' })).not.toBeInTheDocument()
    // The footer is a menu trigger showing the user (mocked: Test User / TU).
    await user.click(screen.getByRole('button', { name: /Test User/ }))
    expect(
      await screen.findByRole('menuitem', { name: 'Profile' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument()
  })

  it('signs out from the footer menu', async () => {
    const user = userEvent.setup()
    render(<SideNav />)
    await user.click(screen.getByRole('button', { name: /Test User/ }))
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }))
    expect(mockSignOut).toHaveBeenCalledOnce()
  })
})
