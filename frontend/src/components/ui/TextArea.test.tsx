import { describe, it, expect, vi } from 'vitest'
import { render, screen, userEvent } from '@/test/utils'
import { TextArea } from './TextArea'

describe('TextArea', () => {
  it('renders a textarea with placeholder', () => {
    render(<TextArea placeholder="Notes…" />)
    expect(screen.getByPlaceholderText('Notes…')).toBeInTheDocument()
  })

  it('applies standard background by default', () => {
    render(<TextArea placeholder="x" />)
    expect(screen.getByPlaceholderText('x')).toHaveClass('bg-input-bg')
  })

  it('applies recessed background when requested', () => {
    render(<TextArea variant="recessed" placeholder="x" />)
    expect(screen.getByPlaceholderText('x')).toHaveClass(
      'bg-input-bg-recessed',
    )
  })

  it('forwards onChange', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<TextArea placeholder="x" onChange={onChange} />)
    await user.type(screen.getByPlaceholderText('x'), 'a')
    expect(onChange).toHaveBeenCalled()
  })

  it('forwards ref to underlying textarea', () => {
    let captured: HTMLTextAreaElement | null = null
    render(
      <TextArea
        placeholder="x"
        ref={(el) => {
          captured = el
        }}
      />,
    )
    expect(captured).toBeInstanceOf(HTMLTextAreaElement)
  })
})
