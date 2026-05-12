import { describe, it, expect, vi } from 'vitest'
import { render, screen, userEvent } from '@/test/utils'
import { Checkbox } from './Checkbox'

describe('Checkbox', () => {
  it('renders an accessible checkbox with label', () => {
    render(<Checkbox label="Accept terms" />)
    expect(
      screen.getByRole('checkbox', { name: 'Accept terms' }),
    ).toBeInTheDocument()
  })

  it('toggles uncontrolled state on click', async () => {
    const user = userEvent.setup()
    render(<Checkbox label="x" />)
    const box = screen.getByRole('checkbox') as HTMLInputElement
    expect(box.checked).toBe(false)
    await user.click(box)
    expect(box.checked).toBe(true)
  })

  it('fires onChange when toggled', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Checkbox label="x" onChange={onChange} />)
    await user.click(screen.getByRole('checkbox'))
    expect(onChange).toHaveBeenCalledOnce()
  })

  it('respects controlled checked prop', () => {
    const { rerender } = render(
      <Checkbox label="x" checked={false} onChange={() => {}} />,
    )
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(
      false,
    )
    rerender(<Checkbox label="x" checked={true} onChange={() => {}} />)
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(
      true,
    )
  })

  it('does not toggle when disabled', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Checkbox label="x" disabled onChange={onChange} />)
    await user.click(screen.getByRole('checkbox'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('forwards ref to underlying input', () => {
    let captured: HTMLInputElement | null = null
    render(
      <Checkbox
        label="x"
        ref={(el) => {
          captured = el
        }}
      />,
    )
    expect(captured).toBeInstanceOf(HTMLInputElement)
  })
})
