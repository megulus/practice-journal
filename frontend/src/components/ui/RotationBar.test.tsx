import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/utils'
import { RotationBar } from './RotationBar'

describe('RotationBar', () => {
  it('renders with role=progressbar', () => {
    render(<RotationBar total={3} current={1} label="x" />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('renders the requested number of segments', () => {
    const { container } = render(
      <RotationBar total={5} current={2} label="x" />,
    )
    expect(container.querySelectorAll('span').length).toBe(5)
  })

  it('fills the first `current` segments with the primary class', () => {
    const { container } = render(
      <RotationBar total={4} current={2} label="x" />,
    )
    const segments = Array.from(container.querySelectorAll('span'))
    expect(segments[0]).toHaveClass('bg-primary')
    expect(segments[1]).toHaveClass('bg-primary')
    expect(segments[2]).toHaveClass('bg-border-default')
    expect(segments[3]).toHaveClass('bg-border-default')
  })

  it('exposes total + current via aria-value attributes', () => {
    render(<RotationBar total={7} current={3} label="x" />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuemax', '7')
    expect(bar).toHaveAttribute('aria-valuenow', '3')
  })

  it('clamps current above total to total', () => {
    render(<RotationBar total={3} current={10} label="x" />)
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '3',
    )
  })

  it('renders an empty bar when current is 0', () => {
    const { container } = render(
      <RotationBar total={3} current={0} label="x" />,
    )
    const segments = Array.from(container.querySelectorAll('span'))
    segments.forEach((s) => expect(s).toHaveClass('bg-border-default'))
  })

  it('renders no segments and drops the progressbar role when total is 0', () => {
    const { container } = render(
      <RotationBar total={0} current={0} label="x" />,
    )
    expect(container.querySelectorAll('span').length).toBe(0)
    // No segments → no progressbar role for assistive tech.
    expect(screen.queryByRole('progressbar')).toBeNull()
  })

  it('treats NaN total/current as 0 (no progressbar role)', () => {
    render(
      <RotationBar
        total={Number.NaN}
        current={Number.NaN}
        label="x"
      />,
    )
    expect(screen.queryByRole('progressbar')).toBeNull()
  })

  it('applies the label as aria-label', () => {
    render(<RotationBar total={3} current={2} label="Rotation progress" />)
    expect(
      screen.getByRole('progressbar', { name: 'Rotation progress' }),
    ).toBeInTheDocument()
  })

  it('forwards ref to underlying div', () => {
    let captured: HTMLDivElement | null = null
    render(
      <RotationBar
        total={3}
        current={1}
        label="x"
        ref={(el) => {
          captured = el
        }}
      />,
    )
    expect(captured).toBeInstanceOf(HTMLDivElement)
  })
})
