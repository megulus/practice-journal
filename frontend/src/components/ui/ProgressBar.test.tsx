import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/utils'
import { ProgressBar } from './ProgressBar'

describe('ProgressBar', () => {
  it('renders with role=progressbar', () => {
    render(<ProgressBar value={0.5} />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('exposes the value as a rounded percentage via aria-valuenow', () => {
    render(<ProgressBar value={0.42} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '42',
    )
  })

  it('clamps values below 0 to 0', () => {
    render(<ProgressBar value={-1} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '0',
    )
  })

  it('clamps values above 1 to 100', () => {
    render(<ProgressBar value={5} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '100',
    )
  })

  it('applies the label as aria-label', () => {
    render(<ProgressBar value={0.5} label="Session progress" />)
    expect(
      screen.getByRole('progressbar', { name: 'Session progress' }),
    ).toBeInTheDocument()
  })

  it('forwards ref to underlying div', () => {
    let captured: HTMLDivElement | null = null
    render(
      <ProgressBar
        value={0.5}
        ref={(el) => {
          captured = el
        }}
      />,
    )
    expect(captured).toBeInstanceOf(HTMLDivElement)
  })
})
