import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, userEvent, waitFor, within } from '@/test/utils'
import { PieceCard } from './PieceCard'
import type { Piece, PieceDetail, Spot } from '@/lib/types'

const { api, mocks } = vi.hoisted(() => {
  const mocks = {
    getPiece: vi.fn(),
    updatePiece: vi.fn().mockResolvedValue(undefined),
    deletePiece: vi.fn().mockResolvedValue(undefined),
    createSpot: vi.fn().mockResolvedValue(undefined),
    updateSpot: vi.fn().mockResolvedValue(undefined),
    retireSpot: vi.fn().mockResolvedValue(undefined),
    unretireSpot: vi.fn().mockResolvedValue(undefined),
    deleteSpot: vi.fn().mockResolvedValue(undefined),
    getSpotHistory: vi.fn(),
  }
  // Stable identity, matching the real memoized useApi.
  return { mocks, api: mocks }
})

vi.mock('@/lib/useApi', () => ({ useApi: () => api }))

const PIECE: Piece = {
  id: 1,
  instrument_id: 9,
  name: 'Bach Partita',
  composer_or_source: 'J.S. Bach',
  session_count: 6,
  last_practiced_at: null,
}

function makeSpot(o: Partial<Spot> = {}): Spot {
  return {
    id: 10,
    name: 'Coda run',
    location: null,
    display_order: 0,
    retired_at: null,
    session_count: 2,
    last_practiced_at: null,
    ...o,
  }
}

function detail(spots: Spot[]): PieceDetail {
  return { ...PIECE, spots }
}

/**
 * The piece header doubles as the expand/collapse control, so its accessible
 * name is the whole header text — matched here on the summary line, which the
 * sibling overflow-menu trigger doesn't share.
 */
const expandToggle = () => screen.getByRole('button', { name: /6 sessions/ })

describe('PieceCard', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((m) => m.mockClear())
    mocks.getPiece.mockResolvedValue(detail([makeSpot()]))
    mocks.getSpotHistory.mockResolvedValue({
      spot: makeSpot(),
      logs: [],
      rating_trend: { step_back: 0, steady: 0, step_forward: 0, skipped: 0 },
    })
  })

  it('renders collapsed, without fetching spots', () => {
    render(<PieceCard piece={PIECE} onChange={vi.fn()} />)
    expect(screen.getByText('Bach Partita')).toBeInTheDocument()
    expect(screen.getByText('J.S. Bach')).toBeInTheDocument()
    expect(screen.getByText('6 sessions · never practiced')).toBeInTheDocument()
    expect(mocks.getPiece).not.toHaveBeenCalled()
  })

  it('loads the spots on first expand, retired ones included', async () => {
    const user = userEvent.setup()
    render(<PieceCard piece={PIECE} onChange={vi.fn()} />)
    await user.click(expandToggle())

    expect(mocks.getPiece).toHaveBeenCalledWith(1, { includeRetiredSpots: true })
    expect(await screen.findByText('Coda run')).toBeInTheDocument()
  })

  it('groups retired spots under their own heading', async () => {
    mocks.getPiece.mockResolvedValue(
      detail([
        makeSpot({ id: 10, name: 'Coda run' }),
        makeSpot({ id: 11, name: 'Old trill', retired_at: '2026-01-01T00:00:00' }),
      ]),
    )
    const user = userEvent.setup()
    render(<PieceCard piece={PIECE} onChange={vi.fn()} />)
    await user.click(expandToggle())

    expect(await screen.findByText('Retired')).toBeInTheDocument()
    expect(screen.getByText('Old trill')).toBeInTheDocument()
  })

  it('adds a spot and resyncs both the spots and the parent list', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<PieceCard piece={PIECE} onChange={onChange} />)
    await user.click(expandToggle())
    await user.click(await screen.findByRole('button', { name: '+ Add spot' }))

    await user.type(screen.getByLabelText('Spot name'), 'Second theme')
    await user.type(screen.getByLabelText('Location'), 'mm. 12')
    await user.click(screen.getByRole('button', { name: 'Add spot' }))

    expect(mocks.createSpot).toHaveBeenCalledWith(1, {
      name: 'Second theme',
      location: 'mm. 12',
    })
    await waitFor(() => expect(onChange).toHaveBeenCalled())
    expect(mocks.getPiece).toHaveBeenCalledTimes(2)
  })

  it('retires a spot from its menu', async () => {
    const user = userEvent.setup()
    render(<PieceCard piece={PIECE} onChange={vi.fn()} />)
    await user.click(expandToggle())
    await user.click(
      await screen.findByRole('button', { name: 'Coda run actions' }),
    )
    await user.click(
      await screen.findByRole('menuitem', { name: 'Retire from rotation' }),
    )
    expect(mocks.retireSpot).toHaveBeenCalledWith(10)
  })

  it('reports a spot mutation failure inside the card, not up the list', async () => {
    mocks.retireSpot.mockRejectedValueOnce(new Error('nope'))
    const user = userEvent.setup()
    const { container } = render(
      <PieceCard piece={PIECE} onChange={vi.fn()} />,
    )
    await user.click(expandToggle())
    await user.click(
      await screen.findByRole('button', { name: 'Coda run actions' }),
    )
    await user.click(
      await screen.findByRole('menuitem', { name: 'Retire from rotation' }),
    )

    // A failed retire moves nothing on screen, so the message has to land in
    // the card the user is looking at rather than at the top of the list.
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/retire/i)
    expect(container.firstChild).toContainElement(alert)
  })

  it('clears a card error once a later action succeeds', async () => {
    mocks.retireSpot.mockRejectedValueOnce(new Error('nope'))
    const user = userEvent.setup()
    render(<PieceCard piece={PIECE} onChange={vi.fn()} />)
    await user.click(expandToggle())
    await user.click(
      await screen.findByRole('button', { name: 'Coda run actions' }),
    )
    await user.click(
      await screen.findByRole('menuitem', { name: 'Retire from rotation' }),
    )
    expect(await screen.findByRole('alert')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Coda run actions' }))
    await user.click(
      await screen.findByRole('menuitem', { name: 'Retire from rotation' }),
    )
    await waitFor(() =>
      expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
    )
  })

  it('reports a failed spot load inside the card', async () => {
    mocks.getPiece.mockRejectedValueOnce(new Error('nope'))
    const user = userEvent.setup()
    render(<PieceCard piece={PIECE} onChange={vi.fn()} />)
    await user.click(expandToggle())
    expect(await screen.findByRole('alert')).toHaveTextContent(/spots/i)
  })

  it('renames the piece inline', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<PieceCard piece={PIECE} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: 'Bach Partita actions' }))
    await user.click(
      await screen.findByRole('menuitem', { name: 'Rename piece' }),
    )

    const name = screen.getByLabelText('Piece name')
    await user.clear(name)
    await user.type(name, 'Partita No. 2')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(mocks.updatePiece).toHaveBeenCalledWith(1, {
      name: 'Partita No. 2',
      composer_or_source: 'J.S. Bach',
    })
    await waitFor(() => expect(onChange).toHaveBeenCalled())
  })

  it('confirms before deleting the piece', async () => {
    const user = userEvent.setup()
    render(<PieceCard piece={PIECE} onChange={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Bach Partita actions' }))
    await user.click(
      await screen.findByRole('menuitem', { name: 'Delete piece' }),
    )

    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(mocks.deletePiece).toHaveBeenCalledWith(1)
  })

  it('opens the per-spot history sheet', async () => {
    const user = userEvent.setup()
    render(<PieceCard piece={PIECE} onChange={vi.fn()} />)
    await user.click(expandToggle())
    await user.click(
      await screen.findByRole('button', { name: 'Coda run actions' }),
    )
    await user.click(
      await screen.findByRole('menuitem', { name: 'View history' }),
    )
    expect(await screen.findByRole('dialog')).toHaveTextContent('Coda run')
    expect(mocks.getSpotHistory).toHaveBeenCalledWith(10)
  })
})
