import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/utils'
import { SectionPip } from './SectionPip'
import { SECTION_COLORS_BY_NAME } from '@/lib/section-colors'

describe('SectionPip', () => {
  it('renders as a span', () => {
    render(
      <SectionPip
        color={SECTION_COLORS_BY_NAME.warmup}
        data-testid="pip"
      />,
    )
    expect(screen.getByTestId('pip').tagName).toBe('SPAN')
  })

  it('applies the section color via inline backgroundColor', () => {
    render(
      <SectionPip
        color={SECTION_COLORS_BY_NAME.blue}
        data-testid="pip"
      />,
    )
    expect(screen.getByTestId('pip')).toHaveStyle({
      backgroundColor: SECTION_COLORS_BY_NAME.blue.pip,
    })
  })

  it('defaults to an 8×8 pip', () => {
    render(
      <SectionPip
        color={SECTION_COLORS_BY_NAME.cooldown}
        data-testid="pip"
      />,
    )
    expect(screen.getByTestId('pip')).toHaveStyle({
      width: '8px',
      height: '8px',
    })
  })

  it('respects a custom size', () => {
    render(
      <SectionPip
        color={SECTION_COLORS_BY_NAME.purple}
        size={12}
        data-testid="pip"
      />,
    )
    expect(screen.getByTestId('pip')).toHaveStyle({
      width: '12px',
      height: '12px',
    })
  })

  it('is aria-hidden by default (decorative)', () => {
    render(
      <SectionPip
        color={SECTION_COLORS_BY_NAME.amber}
        data-testid="pip"
      />,
    )
    expect(screen.getByTestId('pip')).toHaveAttribute('aria-hidden', 'true')
  })

  it('forwards ref to underlying span', () => {
    let captured: HTMLSpanElement | null = null
    render(
      <SectionPip
        color={SECTION_COLORS_BY_NAME.olive}
        ref={(el) => {
          captured = el
        }}
      />,
    )
    expect(captured).toBeInstanceOf(HTMLSpanElement)
  })
})
