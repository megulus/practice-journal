import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, userEvent, within } from '@/test/utils'
import { InstrumentCard } from './InstrumentCard'
import type { Instrument } from '@/lib/types'

const { mockUpdate, mockDelete } = vi.hoisted(() => ({
  mockUpdate: vi.fn().mockResolvedValue(undefined),
  mockDelete: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/useApi', () => ({
  useApi: () => ({ updateInstrument: mockUpdate, deleteInstrument: mockDelete }),
}))

function makeInstrument(o: Partial<Instrument> = {}): Instrument {
  return {
    id: 1,
    name: 'Violin',
    practice_frequency: 'few_times_a_week',
    display_order: 0,
    active_template_count: 1,
    last_practiced_at: null,
    ...o,
  }
}

describe('InstrumentCard', () => {
  beforeEach(() => {
    mockUpdate.mockClear()
    mockDelete.mockClear()
  })

  it('renders the name, active frequency, and summary', () => {
    render(
      <InstrumentCard
        instrument={makeInstrument({ active_template_count: 2 })}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByLabelText('Instrument name')).toHaveValue('Violin')
    expect(
      screen.getByRole('button', { name: 'Few times a week' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByText(/2 active plans · never practiced/),
    ).toBeInTheDocument()
  })

  it('updates the frequency when a different pill is clicked', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<InstrumentCard instrument={makeInstrument()} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: 'Daily' }))
    expect(mockUpdate).toHaveBeenCalledWith(1, { practice_frequency: 'daily' })
    expect(onChange).toHaveBeenCalledOnce()
  })

  it('does nothing when the already-active frequency is clicked', async () => {
    const user = userEvent.setup()
    render(
      <InstrumentCard
        instrument={makeInstrument({ practice_frequency: 'daily' })}
        onChange={vi.fn()}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Daily' }))
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('renames on blur', async () => {
    const user = userEvent.setup()
    render(<InstrumentCard instrument={makeInstrument()} onChange={vi.fn()} />)
    const input = screen.getByLabelText('Instrument name')
    await user.clear(input)
    await user.type(input, 'Viola')
    await user.tab()
    expect(mockUpdate).toHaveBeenCalledWith(1, { name: 'Viola' })
  })

  it('deletes after confirmation, warning that plans go too', async () => {
    const user = userEvent.setup()
    render(
      <InstrumentCard
        instrument={makeInstrument({ active_template_count: 2 })}
        onChange={vi.fn()}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Instrument actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent(/2 plans/)
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(mockDelete).toHaveBeenCalledWith(1)
  })
})
