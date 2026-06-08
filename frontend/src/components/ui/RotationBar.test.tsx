import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/utils'
import { RotationBar } from './RotationBar'

describe('RotationBar', () => {
  it('renders with role=progressbar', () => {
    render(<RotationBar total={3} current={1} />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('renders the requested number of segments', () => {
    const { container } = render(<RotationBar total={5} current={2} />)
    expect(container.querySelectorAll('span').length).toBe(5)
  })

  it('fills the first `current` segments with the primary class', () => {
    const { container } = render(<RotationBar total={4} current={2} />)
    const segments = Array.from(container.querySelectorAll('span'))
    expect(segments[0]).toHaveClass('bg-primary')
    expect(segments[1]).toHaveClass('bg-primary')
    expect(segments[2]).toHaveClass('bg-border-default')
    expect(segments[3]).toHaveClass('bg-border-default')
  })

  it('exposes total + current via aria-value attributes', () => {
    render(<RotationBar total={7} current={3} />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuemax', '7')
    expect(bar).toHaveAttribute('aria-valuenow', '3')
  })

  it('clamps current above total to total', () => {
    render(<RotationBar total={3} current={10} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '3',
    )
  })

  it('renders an empty bar when current is 0', () => {
    const { container } = render(<RotationBar total={3} current={0} />)
    const segments = Array.from(container.querySelectorAll('span'))
    segments.forEach((s) => expect(s).toHaveClass('bg-border-default'))
  })

  it('forwards ref to underlying div', () => {
    let captured: HTMLDivElement | null = null
    render(
      <RotationBar
        total={3}
        current={1}
        ref={(el) => {
          captured = el
        }}
      />,
    )
    expect(captured).toBeInstanceOf(HTMLDivElement)
  })
})
