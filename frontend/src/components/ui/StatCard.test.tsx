import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/utils'
import { StatCard } from './StatCard'

describe('StatCard', () => {
  it('renders the value', () => {
    render(<StatCard value="42" label="Minutes practiced" />)
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('renders the label', () => {
    render(<StatCard value="42" label="Minutes practiced" />)
    expect(screen.getByText('Minutes practiced')).toBeInTheDocument()
  })

  it('accepts a ReactNode value (e.g., with units)', () => {
    render(
      <StatCard
        value={
          <>
            42<span data-testid="unit">m</span>
          </>
        }
        label="Practiced"
      />,
    )
    expect(screen.getByTestId('unit')).toBeInTheDocument()
  })

  it('applies card-bg-inset background class', () => {
    render(
      <StatCard value="x" label="y" data-testid="stat" />,
    )
    expect(screen.getByTestId('stat')).toHaveClass('bg-card-bg-inset')
  })

  it('renders supporting lines below the label when given children', () => {
    render(
      <StatCard value="4 days" label="This week">
        <p>1 hr 42 min total</p>
      </StatCard>,
    )
    expect(screen.getByText('1 hr 42 min total')).toBeInTheDocument()
  })

  it('forwards ref to underlying div', () => {
    let captured: HTMLDivElement | null = null
    render(
      <StatCard
        value="x"
        label="y"
        ref={(el) => {
          captured = el
        }}
      />,
    )
    expect(captured).toBeInstanceOf(HTMLDivElement)
  })
})
