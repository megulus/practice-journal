import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@/test/utils'
import AddBlockSheet from './AddBlockSheet'

const { mockBrowseCurated, mockListRecent } = vi.hoisted(() => ({
  mockBrowseCurated: vi.fn().mockResolvedValue([]),
  mockListRecent: vi.fn().mockResolvedValue([]),
}))

// Stable object: the component has `api` in an effect dependency array, so a
// fresh object each render would re-fetch forever.
const mockApi = {
  browseCuratedBlocks: mockBrowseCurated,
  listRecentBlocks: mockListRecent,
}

vi.mock('@/lib/useApi', () => ({ useApi: () => mockApi }))

describe('AddBlockSheet', () => {
  beforeEach(() => {
    mockBrowseCurated.mockClear()
    mockListRecent.mockClear()
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
})
