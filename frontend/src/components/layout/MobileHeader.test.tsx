import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/utils'
import MobileHeader from './MobileHeader'

describe('MobileHeader', () => {
  it('renders the wordmark and an avatar link to the profile', () => {
    render(<MobileHeader />)
    expect(screen.getByText('Kantelo')).toBeInTheDocument()

    // Avatar links to /profile, labelled with the user's name (mocked: Test User).
    const avatar = screen.getByRole('link', { name: /Test User/ })
    expect(avatar).toHaveAttribute('href', '/profile')
    expect(avatar).toHaveTextContent('TU')
  })
})
