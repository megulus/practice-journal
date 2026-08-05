import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, userEvent, waitFor } from '@/test/utils'
import { RepertoireLibrary } from './RepertoireLibrary'
import type { Piece } from '@/lib/types'

const { api, mocks } = vi.hoisted(() => {
  const mocks = {
    listPieces: vi.fn(),
    createPiece: vi.fn().mockResolvedValue(undefined),
    getPiece: vi.fn(),
  }
  return { mocks, api: mocks }
})

vi.mock('@/lib/useApi', () => ({ useApi: () => api }))

const PIECE: Piece = {
  id: 1,
  instrument_id: 9,
  name: 'Bach Partita',
  composer_or_source: null,
  session_count: 0,
  last_practiced_at: null,
}

describe('RepertoireLibrary', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((m) => m.mockClear())
    mocks.listPieces.mockResolvedValue([PIECE])
  })

  it('lists the instrument’s pieces', async () => {
    render(<RepertoireLibrary instrumentId={9} />)
    expect(await screen.findByText('Bach Partita')).toBeInTheDocument()
    expect(mocks.listPieces).toHaveBeenCalledWith(9)
  })

  it('explains the empty state', async () => {
    mocks.listPieces.mockResolvedValue([])
    render(<RepertoireLibrary instrumentId={9} />)
    expect(await screen.findByText(/No pieces yet/)).toBeInTheDocument()
  })

  it('adds a piece and refetches', async () => {
    const user = userEvent.setup()
    render(<RepertoireLibrary instrumentId={9} />)
    await user.click(await screen.findByRole('button', { name: '+ Add piece' }))

    await user.type(screen.getByLabelText('New piece name'), 'Kreutzer 2')
    await user.type(screen.getByLabelText('Composer or source'), 'Kreutzer')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(mocks.createPiece).toHaveBeenCalledWith(9, {
      name: 'Kreutzer 2',
      composer_or_source: 'Kreutzer',
    })
    await waitFor(() => expect(mocks.listPieces).toHaveBeenCalledTimes(2))
    // Collapses back to the dashed affordance on success.
    expect(
      await screen.findByRole('button', { name: '+ Add piece' }),
    ).toBeInTheDocument()
  })

  it('keeps the add form open and shows the error when the create fails', async () => {
    mocks.createPiece.mockRejectedValueOnce(new Error('nope'))
    const user = userEvent.setup()
    render(<RepertoireLibrary instrumentId={9} />)
    await user.click(await screen.findByRole('button', { name: '+ Add piece' }))
    await user.type(screen.getByLabelText('New piece name'), 'Kreutzer 2')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/add the piece/i)
    expect(screen.getByLabelText('New piece name')).toHaveValue('Kreutzer 2')
  })

  it('reports a load failure', async () => {
    mocks.listPieces.mockRejectedValueOnce(new Error('nope'))
    render(<RepertoireLibrary instrumentId={9} />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/repertoire/i)
  })
})
