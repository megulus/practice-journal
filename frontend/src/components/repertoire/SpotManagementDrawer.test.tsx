import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, userEvent, waitFor } from '@/test/utils'
import type { DefaultSpot, Spot } from '@/lib/types'
import { SpotManagementDrawer } from './SpotManagementDrawer'

const DAY = 86_400_000
const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * DAY).toISOString()

const SPOTS: Spot[] = [
  {
    id: 1,
    name: 'first page',
    location: 'mm. 1–32',
    display_order: 0,
    retired_at: null,
    session_count: 8,
    last_practiced_at: iso(1),
  },
  {
    id: 2,
    name: 'development',
    location: null,
    display_order: 1,
    retired_at: null,
    session_count: 4,
    last_practiced_at: iso(3),
  },
  {
    id: 3,
    name: 'descending arpeggios drill',
    location: null,
    display_order: 2,
    retired_at: iso(42),
    session_count: 11,
    last_practiced_at: iso(42),
  },
]

// "first page" is already in this block's defaults; the other two are not.
const DEFAULT_SPOTS: DefaultSpot[] = [
  { id: 1, name: 'first page', location: 'mm. 1–32', display_order: 0 },
]

const {
  mockGetPiece,
  mockAddDefaultSpot,
  mockRemoveDefaultSpot,
  mockReorderDefaultSpots,
  mockCreateSpot,
  mockUnretireSpot,
} = vi.hoisted(() => ({
  mockGetPiece: vi.fn(),
  mockAddDefaultSpot: vi.fn().mockResolvedValue({}),
  mockRemoveDefaultSpot: vi.fn().mockResolvedValue(undefined),
  mockReorderDefaultSpots: vi.fn().mockResolvedValue({}),
  mockCreateSpot: vi.fn(),
  mockUnretireSpot: vi.fn().mockResolvedValue({}),
}))

// One stable object: `api` is in a load effect's dependency array, and a fresh
// mock per render would re-fetch forever (#277).
const mockApi = {
  getPiece: mockGetPiece,
  addDefaultSpot: mockAddDefaultSpot,
  removeDefaultSpot: mockRemoveDefaultSpot,
  reorderDefaultSpots: mockReorderDefaultSpots,
  createSpot: mockCreateSpot,
  unretireSpot: mockUnretireSpot,
}

vi.mock('@/lib/useApi', () => ({ useApi: () => mockApi }))

function renderDrawer(overrides: Partial<Parameters<typeof SpotManagementDrawer>[0]> = {}) {
  const onChange = vi.fn().mockResolvedValue(undefined)
  const onClose = vi.fn()
  render(
    <SpotManagementDrawer
      blockId={10}
      pieceId={5}
      pieceName="Bruch Concerto"
      defaultSpots={DEFAULT_SPOTS}
      onChange={onChange}
      onClose={onClose}
      {...overrides}
    />,
  )
  return { onChange, onClose }
}

/** Opens the "+ Add spot" search and types a query. */
async function search(user: ReturnType<typeof userEvent.setup>, query: string) {
  await user.click(screen.getByRole('button', { name: 'Add spot' }))
  await user.type(await screen.findByLabelText('Search spots'), query)
}

describe('SpotManagementDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    mockGetPiece.mockResolvedValue({
      id: 5,
      instrument_id: 1,
      name: 'Bruch Concerto',
      composer_or_source: 'Bruch',
      session_count: 12,
      last_practiced_at: iso(1),
      spots: SPOTS,
    })
    mockCreateSpot.mockResolvedValue({
      id: 99,
      name: 'cadenza',
      location: 'mm. 158–172',
      display_order: 3,
      retired_at: null,
      session_count: 0,
      last_practiced_at: null,
    })
  })

  it('shows the piece name and its default spots, and loads retired spots too', async () => {
    renderDrawer()

    expect(screen.getByText('Bruch Concerto')).toBeInTheDocument()
    expect(screen.getByText('first page')).toBeInTheDocument()
    expect(screen.getByText('mm. 1–32')).toBeInTheDocument()

    await waitFor(() =>
      expect(mockGetPiece).toHaveBeenCalledWith(5, { includeRetiredSpots: true }),
    )
  })

  it('removes a spot from the block defaults without touching the piece', async () => {
    const user = userEvent.setup()
    const { onChange } = renderDrawer()

    await user.click(
      screen.getByRole('button', { name: 'Remove first page from defaults' }),
    )

    await waitFor(() => expect(mockRemoveDefaultSpot).toHaveBeenCalledWith(10, 1))
    expect(onChange).toHaveBeenCalled()
  })

  it('adds a matching active spot to the defaults in one tap', async () => {
    const user = userEvent.setup()
    const { onChange } = renderDrawer()

    await search(user, 'de')

    // Grouped under ON THIS PIECE, with a recency hint.
    expect(await screen.findByText('On this piece')).toBeInTheDocument()
    expect(screen.getByText(/3 days ago/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /development/ }))

    await waitFor(() => expect(mockAddDefaultSpot).toHaveBeenCalledWith(10, 2))
    expect(mockUnretireSpot).not.toHaveBeenCalled()
    expect(onChange).toHaveBeenCalled()
    // Back to the default spots list once it lands.
    expect(await screen.findByText('Default spots')).toBeInTheDocument()
  })

  it('un-retires a retired spot only after the inline confirmation', async () => {
    const user = userEvent.setup()
    const { onChange } = renderDrawer()

    await search(user, 'de')

    expect(await screen.findByText('Retired')).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: /descending arpeggios drill/ }),
    )

    // One extra tap: nothing has been written yet.
    expect(
      await screen.findByText(/Bring back .descending arpeggios drill/),
    ).toBeInTheDocument()
    expect(mockUnretireSpot).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Bring back' }))

    await waitFor(() => expect(mockUnretireSpot).toHaveBeenCalledWith(3))
    expect(mockAddDefaultSpot).toHaveBeenCalledWith(10, 3)
    expect(onChange).toHaveBeenCalled()
  })

  it('cancels the un-retire confirmation without writing anything', async () => {
    const user = userEvent.setup()
    renderDrawer()

    await search(user, 'de')
    await user.click(
      screen.getByRole('button', { name: /descending arpeggios drill/ }),
    )
    await user.click(await screen.findByRole('button', { name: 'Cancel' }))

    expect(mockUnretireSpot).not.toHaveBeenCalled()
    expect(mockAddDefaultSpot).not.toHaveBeenCalled()
    expect(await screen.findByLabelText('Search spots')).toBeInTheDocument()
  })

  it('creates a spot from the search text and adds it to the defaults', async () => {
    const user = userEvent.setup()
    const { onChange } = renderDrawer()

    await search(user, 'cadenza')

    // Search doubles as create when nothing matches what was typed.
    await user.click(await screen.findByRole('button', { name: /Create .cadenza/ }))

    // Name pre-filled from the search text, plus the location field's chips.
    expect(await screen.findByLabelText('Spot name')).toHaveValue('cadenza')
    await user.click(screen.getByRole('button', { name: 'Insert “mm.”' }))
    await user.type(screen.getByLabelText('Location'), '158–172')

    await user.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() =>
      expect(mockCreateSpot).toHaveBeenCalledWith(5, {
        name: 'cadenza',
        location: expect.stringContaining('mm.'),
      }),
    )
    expect(mockAddDefaultSpot).toHaveBeenCalledWith(10, 99)
    expect(onChange).toHaveBeenCalled()
    expect(await screen.findByText('Default spots')).toBeInTheDocument()
  })

  it('hides the create affordance when the text already names a spot', async () => {
    const user = userEvent.setup()
    renderDrawer()

    // Exact match on a retired spot still blocks creation — no accidental dupes.
    await search(user, 'descending arpeggios drill')

    expect(
      await screen.findByRole('button', { name: /descending arpeggios drill/ }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Create/ })).toBeNull()
  })

  it('surfaces a write failure without closing the drawer', async () => {
    const user = userEvent.setup()
    mockRemoveDefaultSpot.mockRejectedValueOnce(new Error('boom'))
    const { onClose } = renderDrawer()

    await user.click(
      screen.getByRole('button', { name: 'Remove first page from defaults' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(/didn't save/)
    expect(onClose).not.toHaveBeenCalled()
  })
})
