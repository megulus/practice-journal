import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@/test/utils'
import { InstrumentManager } from './InstrumentManager'
import type { Instrument } from '@/lib/types'

const { mockList } = vi.hoisted(() => ({ mockList: vi.fn() }))

vi.mock('@/lib/useApi', () => ({
  useApi: () => ({
    listInstruments: mockList,
    updateInstrument: vi.fn(),
    deleteInstrument: vi.fn(),
    createInstrument: vi.fn(),
  }),
}))

function makeInstrument(o: Partial<Instrument> = {}): Instrument {
  return {
    id: 1,
    name: 'Violin',
    practice_frequency: 'daily',
    display_order: 0,
    active_template_count: 0,
    piece_count: 0,
    last_practiced_at: null,
    ...o,
  }
}

describe('InstrumentManager', () => {
  it('lists the instruments as editable cards plus an add affordance', async () => {
    mockList.mockResolvedValue([
      makeInstrument({ id: 1, name: 'Violin' }),
      makeInstrument({ id: 2, name: 'Piano' }),
    ])
    render(<InstrumentManager />)
    expect(await screen.findByDisplayValue('Violin')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Piano')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '+ Add instrument' }),
    ).toBeInTheDocument()
  })

  it('shows an empty state (with the add button) when there are none', async () => {
    mockList.mockResolvedValue([])
    render(<InstrumentManager />)
    expect(await screen.findByText(/No instruments yet/)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '+ Add instrument' }),
    ).toBeInTheDocument()
  })

  it('surfaces a load failure as a non-blocking alert banner', async () => {
    mockList.mockReset()
    mockList.mockRejectedValue(new Error('boom'))
    render(<InstrumentManager />)
    // The add affordance still renders alongside the error.
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '+ Add instrument' }),
    ).toBeInTheDocument()
  })
})
