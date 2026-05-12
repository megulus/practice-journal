import { describe, it, expect, vi } from 'vitest'
import { render, screen, userEvent } from '@/test/utils'
import { TextInput } from './TextInput'

describe('TextInput', () => {
  it('renders an input with placeholder', () => {
    render(<TextInput placeholder="Type here…" />)
    expect(screen.getByPlaceholderText('Type here…')).toBeInTheDocument()
  })

  it('applies standard background by default', () => {
    render(<TextInput placeholder="x" />)
    expect(screen.getByPlaceholderText('x')).toHaveClass('bg-input-bg')
  })

  it('applies recessed background when requested', () => {
    render(<TextInput variant="recessed" placeholder="x" />)
    expect(screen.getByPlaceholderText('x')).toHaveClass(
      'bg-input-bg-recessed',
    )
  })

  it('forwards onChange', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<TextInput placeholder="x" onChange={onChange} />)
    await user.type(screen.getByPlaceholderText('x'), 'a')
    expect(onChange).toHaveBeenCalled()
  })

  it('forwards ref to underlying input', () => {
    let captured: HTMLInputElement | null = null
    render(
      <TextInput
        placeholder="x"
        ref={(el) => {
          captured = el
        }}
      />,
    )
    expect(captured).toBeInstanceOf(HTMLInputElement)
  })
})
