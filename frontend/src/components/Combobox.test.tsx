import { describe, it, expect, vi } from 'vitest'
import { render, screen, userEvent } from '@/test/utils'
import Combobox from './Combobox'

const suggestions = ['warm-up', 'scales', 'arpeggios', 'sight-reading']

describe('Combobox', () => {
  it('renders input with placeholder', () => {
    render(
      <Combobox value="" onChange={() => {}} suggestions={suggestions} placeholder="Section name" />
    )
    expect(screen.getByPlaceholderText('Section name')).toBeInTheDocument()
  })

  it('shows suggestions on focus', async () => {
    const user = userEvent.setup()
    render(<Combobox value="" onChange={() => {}} suggestions={suggestions} />)

    await user.click(screen.getByRole('textbox'))
    expect(screen.getByText('warm-up')).toBeInTheDocument()
    expect(screen.getByText('scales')).toBeInTheDocument()
  })

  it('filters suggestions by input value', async () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <Combobox value="sc" onChange={onChange} suggestions={suggestions} />
    )

    // Focus to open
    const user = userEvent.setup()
    await user.click(screen.getByRole('textbox'))

    expect(screen.getByText('scales')).toBeInTheDocument()
    expect(screen.queryByText('warm-up')).not.toBeInTheDocument()
  })

  it('calls onChange when a suggestion is selected', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()

    render(<Combobox value="" onChange={onChange} suggestions={suggestions} />)
    await user.click(screen.getByRole('textbox'))
    await user.click(screen.getByText('scales'))
    expect(onChange).toHaveBeenCalledWith('scales')
  })

  it('supports keyboard navigation', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()

    render(<Combobox value="" onChange={onChange} suggestions={suggestions} />)
    const input = screen.getByRole('textbox')

    await user.click(input)
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    expect(onChange).toHaveBeenCalledWith('scales')
  })

  it('closes dropdown on escape', async () => {
    const user = userEvent.setup()
    render(<Combobox value="" onChange={() => {}} suggestions={suggestions} />)

    await user.click(screen.getByRole('textbox'))
    expect(screen.getByText('warm-up')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByText('warm-up')).not.toBeInTheDocument()
  })
})
