import { describe, it, expect, vi } from 'vitest'
import { render, screen, userEvent } from '@/test/utils'
import { Radio } from './Radio'

describe('Radio', () => {
  it('renders label and description, and reflects checked state', () => {
    render(
      <Radio
        name="g"
        value="a"
        label="All suggestions"
        description="Before, during, and after practice"
        checked
        onChange={vi.fn()}
      />,
    )
    const radio = screen.getByRole('radio', { name: /All suggestions/ })
    expect(radio).toBeChecked()
    expect(
      screen.getByText('Before, during, and after practice'),
    ).toBeInTheDocument()
  })

  it('fires onChange when picked', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <>
        <Radio name="g" value="a" label="A" checked onChange={vi.fn()} />
        <Radio name="g" value="b" label="B" checked={false} onChange={onChange} />
      </>,
    )
    await user.click(screen.getByRole('radio', { name: 'B' }))
    expect(onChange).toHaveBeenCalledOnce()
  })

  it('does not fire when disabled', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <Radio
        name="g"
        value="a"
        label="A"
        checked={false}
        disabled
        onChange={onChange}
      />,
    )
    await user.click(screen.getByRole('radio', { name: 'A' }))
    expect(onChange).not.toHaveBeenCalled()
  })
})
