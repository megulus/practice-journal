import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, userEvent, waitFor } from '@/test/utils'
import AddBlockSheet from './AddBlockSheet'

const { mockBrowseCurated, mockListRecent, mockListRepertoire, mockCreatePiece } =
  vi.hoisted(() => ({
    mockBrowseCurated: vi.fn().mockResolvedValue([]),
    mockListRecent: vi.fn().mockResolvedValue([]),
    mockListRepertoire: vi.fn(),
    mockCreatePiece: vi.fn(),
  }))

// Stable object: the component has `api` in an effect dependency array, so a
// fresh object each render would re-fetch forever.
const mockApi = {
  browseCuratedBlocks: mockBrowseCurated,
  listRecentBlocks: mockListRecent,
  listRepertoirePieces: mockListRepertoire,
  createPiece: mockCreatePiece,
}

vi.mock('@/lib/useApi', () => ({ useApi: () => mockApi }))

const PIECES = [
  {
    id: 4,
    name: 'Bruch Concerto',
    composer_or_source: 'Bruch',
    active_spot_count: 3,
    last_practiced_at: null,
    spots: [],
  },
]

function renderSheet(onAdd = vi.fn().mockResolvedValue(undefined)) {
  const onClose = vi.fn()
  render(
    <AddBlockSheet
      sectionName="Repertoire"
      instrumentCategory="violin"
      instrumentId={7}
      onAdd={onAdd}
      onClose={onClose}
    />,
  )
  return { onAdd, onClose }
}

describe('AddBlockSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListRepertoire.mockResolvedValue({ pieces: PIECES })
    mockCreatePiece.mockResolvedValue({
      id: 12,
      instrument_id: 7,
      name: 'Sibelius Concerto',
      composer_or_source: 'Sibelius',
      session_count: 0,
      last_practiced_at: null,
    })
  })

  it('browses curated blocks by canonical category, not instrument name', async () => {
    // A renamed instrument ("Mom's Violin") still resolves to "violin" — #170.
    render(
      <AddBlockSheet
        sectionName="Scales"
        instrumentCategory="violin"
        instrumentId={7}
        onAdd={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    await waitFor(() =>
      expect(mockBrowseCurated).toHaveBeenCalledWith({
        instrument: 'violin',
        q: undefined,
      }),
    )
    expect(await screen.findByText(/No matches/)).toBeInTheDocument()
  })

  describe('"Your repertoire" tab', () => {
    it('adds a repertoire block for an existing piece', async () => {
      const user = userEvent.setup()
      const { onAdd, onClose } = renderSheet()

      await user.click(screen.getByRole('button', { name: 'Your rep.' }))

      await waitFor(() => expect(mockListRepertoire).toHaveBeenCalledWith(7))
      await user.click(await screen.findByRole('button', { name: /Bruch Concerto/ }))

      // Empty block: default spots are configured in the drawer afterwards.
      await waitFor(() => expect(onAdd).toHaveBeenCalledWith({ piece_id: 4 }))
      expect(onClose).toHaveBeenCalled()
    })

    it('creates a piece from the search text, then adds its block', async () => {
      const user = userEvent.setup()
      const { onAdd } = renderSheet()

      await user.click(screen.getByRole('button', { name: 'Your rep.' }))
      await user.type(
        await screen.findByLabelText('Search pieces'),
        'Sibelius Concerto',
      )

      // No match for the typed text, so search doubles as create.
      expect(screen.queryByRole('button', { name: /Bruch Concerto/ })).toBeNull()
      await user.click(screen.getByRole('button', { name: /Create .Sibelius/ }))

      expect(await screen.findByLabelText('New piece name')).toHaveValue(
        'Sibelius Concerto',
      )
      await user.type(screen.getByLabelText('Composer or source'), 'Sibelius')
      await user.click(screen.getByRole('button', { name: 'Create' }))

      await waitFor(() =>
        expect(mockCreatePiece).toHaveBeenCalledWith(7, {
          name: 'Sibelius Concerto',
          composer_or_source: 'Sibelius',
        }),
      )
      expect(onAdd).toHaveBeenCalledWith({ piece_id: 12 })
    })

    it('offers to create the first piece when the library is empty', async () => {
      const user = userEvent.setup()
      mockListRepertoire.mockResolvedValue({ pieces: [] })
      renderSheet()

      await user.click(screen.getByRole('button', { name: 'Your rep.' }))

      expect(await screen.findByText('No pieces yet.')).toBeInTheDocument()
      expect(screen.getByText('Type to create one.')).toBeInTheDocument()
    })
  })
})
