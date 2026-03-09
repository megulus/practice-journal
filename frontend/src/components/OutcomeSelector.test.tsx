import { describe, it, expect, vi } from 'vitest'
import { render, screen, userEvent } from '@/test/utils'
import OutcomeSelector from './OutcomeSelector'

describe('OutcomeSelector', () => {
  it('renders all three outcomes', () => {
    render(<OutcomeSelector onChange={() => {}} />)
    expect(screen.getByText(/Struggled/)).toBeInTheDocument()
    expect(screen.getByText(/Okay/)).toBeInTheDocument()
    expect(screen.getByText(/Nailed it!/)).toBeInTheDocument()
  })

  it('calls onChange with outcome value on click', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()

    render(<OutcomeSelector onChange={onChange} />)
    await user.click(screen.getByText(/Nailed it!/))
    expect(onChange).toHaveBeenCalledWith('nailed_it')
  })

  it('deselects when clicking the selected outcome', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()

    render(<OutcomeSelector value="okay" onChange={onChange} />)
    await user.click(screen.getByText(/Okay/))
    expect(onChange).toHaveBeenCalledWith(undefined)
  })

  it('selects a different outcome when one is already selected', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()

    render(<OutcomeSelector value="struggled" onChange={onChange} />)
    await user.click(screen.getByText(/Nailed it!/))
    expect(onChange).toHaveBeenCalledWith('nailed_it')
  })
})
