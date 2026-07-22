import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, userEvent, waitFor } from '@/test/utils'
import { AddInstrument } from './AddInstrument'

const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/useApi', () => ({
  useApi: () => ({ createInstrument: mockCreate }),
}))

describe('AddInstrument', () => {
  beforeEach(() => {
    mockCreate.mockClear()
  })

  it('creates an instrument with the default cadence, then collapses', async () => {
    const onAdded = vi.fn()
    const user = userEvent.setup()
    render(<AddInstrument onAdded={onAdded} />)

    await user.click(screen.getByRole('button', { name: '+ Add instrument' }))
    await user.type(screen.getByLabelText('New instrument name'), 'Cello')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(mockCreate).toHaveBeenCalledWith({
      name: 'Cello',
      practice_frequency: 'few_times_a_week',
    })
    expect(onAdded).toHaveBeenCalledOnce()
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: '+ Add instrument' }),
      ).toBeInTheDocument(),
    )
  })

  it('lets you pick a different cadence', async () => {
    const user = userEvent.setup()
    render(<AddInstrument onAdded={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: '+ Add instrument' }))
    await user.type(screen.getByLabelText('New instrument name'), 'Cello')
    await user.click(screen.getByRole('button', { name: 'Daily' }))
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(mockCreate).toHaveBeenCalledWith({
      name: 'Cello',
      practice_frequency: 'daily',
    })
  })

  it('disables Add for an empty name', async () => {
    const user = userEvent.setup()
    render(<AddInstrument onAdded={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: '+ Add instrument' }))
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
    expect(mockCreate).not.toHaveBeenCalled()
  })
})
