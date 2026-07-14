import { describe, it, expect, vi } from 'vitest'
import { render, screen, userEvent } from '@/test/utils'
import RatingChevrons from './RatingChevrons'

describe('RatingChevrons', () => {
  it('renders the three directional buttons', () => {
    render(<RatingChevrons value={null} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Step back' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Steady' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Step forward' })
    ).toBeInTheDocument()
  })

  it('marks the button matching the current value as pressed', () => {
    render(<RatingChevrons value={1} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Step forward' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByRole('button', { name: 'Steady' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  })

  it('leaves all buttons unpressed when value is null', () => {
    render(<RatingChevrons value={null} onChange={vi.fn()} />)
    for (const name of ['Step back', 'Steady', 'Step forward']) {
      expect(screen.getByRole('button', { name })).toHaveAttribute(
        'aria-pressed',
        'false'
      )
    }
  })

  it('calls onChange with the rating when a button is clicked', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<RatingChevrons value={null} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Step back' }))
    expect(onChange).toHaveBeenCalledExactlyOnceWith(-1)
  })

  it('does not fire onChange when disabled', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<RatingChevrons value={null} onChange={onChange} disabled />)

    await user.click(screen.getByRole('button', { name: 'Step forward' }))
    expect(onChange).not.toHaveBeenCalled()
  })
})
