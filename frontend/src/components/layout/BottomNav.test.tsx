import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/utils'
import BottomNav from './BottomNav'

describe('BottomNav', () => {
  it('renders all four tabs with correct hrefs', () => {
    render(<BottomNav />)
    const expected = [
      ['Today', '/today'],
      ['Progress', '/progress'],
      ['Plans', '/plans'],
      ['Profile', '/profile'],
    ]
    for (const [label, href] of expected) {
      const link = screen.getByRole('link', { name: label })
      expect(link).toHaveAttribute('href', href)
    }
  })
})
