import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/utils'
import SideNav from './SideNav'

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

  it('shows Profile in the footer, not as a primary nav link', () => {
    render(<SideNav />)
    // From the mocked Clerk user: Test User / test@example.com / TU.
    const footer = screen.getByRole('link', { name: /Test User/ })
    expect(footer).toHaveAttribute('href', '/profile')
    expect(screen.getByText('test@example.com')).toBeInTheDocument()
    expect(screen.getByText('TU')).toBeInTheDocument()
    // Profile is not one of the primary links.
    expect(screen.queryByRole('link', { name: 'Profile' })).not.toBeInTheDocument()
  })
})
