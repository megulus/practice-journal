import { describe, it, expect, vi } from 'vitest'
import { render, screen, userEvent } from '@/test/utils'
import { Pill } from './Pill'
import { SECTION_COLORS_BY_NAME } from '@/lib/section-colors'

describe('Pill', () => {
  describe('instrument variant (default)', () => {
    it('renders as a button with the label', () => {
      render(<Pill>Violin</Pill>)
      expect(
        screen.getByRole('button', { name: 'Violin' }),
      ).toBeInTheDocument()
    })

    it('reflects active state via classes and aria-pressed', () => {
      render(<Pill active>On</Pill>)
      const btn = screen.getByRole('button')
      expect(btn).toHaveAttribute('aria-pressed', 'true')
      expect(btn).toHaveClass('bg-pill-active-bg')
    })

    it('reflects inactive state', () => {
      render(<Pill>Off</Pill>)
      const btn = screen.getByRole('button')
      expect(btn).toHaveAttribute('aria-pressed', 'false')
      expect(btn).toHaveClass('border-pill-inactive-border')
    })

    it('forwards onClick', async () => {
      const onClick = vi.fn()
      const user = userEvent.setup()
      render(<Pill onClick={onClick}>x</Pill>)
      await user.click(screen.getByRole('button'))
      expect(onClick).toHaveBeenCalledOnce()
    })

    it('omits aria-pressed when caller overrides role (e.g., radio)', () => {
      render(
        <Pill role="radio" aria-checked={true} active>
          x
        </Pill>,
      )
      const el = screen.getByRole('radio')
      expect(el).not.toHaveAttribute('aria-pressed')
      expect(el).toHaveAttribute('aria-checked', 'true')
    })
  })

  describe('sectionType variant', () => {
    it('renders as a span (no button role) and applies color via inline style', () => {
      render(
        <Pill variant="sectionType" color={SECTION_COLORS_BY_NAME.warmup}>
          Warm-up
        </Pill>,
      )
      // Not a button — should not be focusable as one
      expect(screen.queryByRole('button')).toBeNull()
      const span = screen.getByText('Warm-up')
      expect(span.tagName).toBe('SPAN')
      expect(span).toHaveStyle({
        backgroundColor: SECTION_COLORS_BY_NAME.warmup.pillBg,
      })
    })
  })
})
