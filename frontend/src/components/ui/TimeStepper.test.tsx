import { describe, it, expect, vi } from 'vitest'
import { render, screen, userEvent } from '@/test/utils'
import TimeStepper from './TimeStepper'

describe('TimeStepper', () => {
  it('renders the current value in minutes', () => {
    render(<TimeStepper value={12} onChange={vi.fn()} />)
    expect(screen.getByText('12 min')).toBeInTheDocument()
  })

  it('increments by one minute', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<TimeStepper value={5} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Increase duration' }))
    expect(onChange).toHaveBeenCalledExactlyOnceWith(6)
  })

  it('decrements by one minute', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<TimeStepper value={5} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Decrease duration' }))
    expect(onChange).toHaveBeenCalledExactlyOnceWith(4)
  })

  it('disables decrement at zero and never goes negative', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<TimeStepper value={0} onChange={onChange} />)

    const dec = screen.getByRole('button', { name: 'Decrease duration' })
    expect(dec).toBeDisabled()
    await user.click(dec)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('disables both controls when disabled', () => {
    render(<TimeStepper value={5} onChange={vi.fn()} disabled />)
    expect(screen.getByRole('button', { name: 'Increase duration' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Decrease duration' })).toBeDisabled()
  })
})
