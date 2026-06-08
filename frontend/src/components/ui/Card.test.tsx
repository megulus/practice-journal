import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/utils'
import { Card } from './Card'

describe('Card', () => {
  it('renders children inside a div by default', () => {
    render(<Card>hello</Card>)
    const node = screen.getByText('hello')
    expect(node.tagName).toBe('DIV')
  })

  it('applies default variant classes by default', () => {
    render(<Card data-testid="card">x</Card>)
    expect(screen.getByTestId('card')).toHaveClass('bg-card-bg')
  })

  it('applies suggestion variant classes when requested', () => {
    render(
      <Card variant="suggestion" data-testid="card">
        x
      </Card>,
    )
    expect(screen.getByTestId('card')).toHaveClass('bg-amber-bg')
  })

  it('applies coaching variant classes when requested', () => {
    render(
      <Card variant="coaching" data-testid="card">
        x
      </Card>,
    )
    expect(screen.getByTestId('card')).toHaveClass('bg-coaching-bg')
  })

  it('applies hint variant classes when requested', () => {
    render(
      <Card variant="hint" data-testid="card">
        x
      </Card>,
    )
    expect(screen.getByTestId('card')).toHaveClass('bg-input-bg-recessed')
  })

  it('renders the icon slot for suggestion variant', () => {
    render(
      <Card variant="suggestion" icon={<span data-testid="icon">!</span>}>
        body
      </Card>,
    )
    expect(screen.getByTestId('icon')).toBeInTheDocument()
    expect(screen.getByText('body')).toBeInTheDocument()
  })

  it('forwards ref to underlying div', () => {
    let captured: HTMLDivElement | null = null
    render(
      <Card
        ref={(el) => {
          captured = el
        }}
      >
        x
      </Card>,
    )
    expect(captured).toBeInstanceOf(HTMLDivElement)
  })
})
