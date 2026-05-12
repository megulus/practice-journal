import { describe, it, expect, vi } from 'vitest'
import { render, screen, userEvent } from '@/test/utils'
import { Button } from './Button'

describe('Button', () => {
  it('renders children and is a button by default', () => {
    render(<Button>Click me</Button>)
    const btn = screen.getByRole('button', { name: 'Click me' })
    expect(btn).toHaveAttribute('type', 'button')
  })

  it('applies primary variant classes by default', () => {
    render(<Button>x</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-primary')
  })

  it('applies secondary variant classes when requested', () => {
    render(<Button variant="secondary">x</Button>)
    expect(screen.getByRole('button')).toHaveClass('border-border-input')
  })

  it('applies danger variant classes when requested', () => {
    render(<Button variant="danger">x</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-danger-text')
  })

  it('adds w-full when fullWidth is set', () => {
    render(<Button fullWidth>x</Button>)
    expect(screen.getByRole('button')).toHaveClass('w-full')
  })

  it('forwards onClick', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<Button onClick={onClick}>x</Button>)
    await user.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('does not fire onClick when disabled', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(
      <Button onClick={onClick} disabled>
        x
      </Button>,
    )
    await user.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('forwards ref to underlying button', () => {
    let captured: HTMLButtonElement | null = null
    render(
      <Button
        ref={(el) => {
          captured = el
        }}
      >
        x
      </Button>,
    )
    expect(captured).toBeInstanceOf(HTMLButtonElement)
  })
})
