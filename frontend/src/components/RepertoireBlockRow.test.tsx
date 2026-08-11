import { describe, it, expect, vi } from 'vitest'
import { render, screen, userEvent } from '@/test/utils'
import type { Block } from '@/lib/types'
import RepertoireBlockRow from './RepertoireBlockRow'

const block: Block = {
  id: 3,
  name: null,
  description: null,
  estimated_duration_minutes: 15,
  tempo_bpm: null,
  key: null,
  difficulty_level: null,
  display_order: 0,
  curated_block_id: null,
  piece_id: 5,
  piece_name: 'Bruch Concerto',
  default_spots: [
    { id: 1, name: 'first page', location: 'mm. 1–32', display_order: 0 },
    { id: 2, name: 'development', location: null, display_order: 1 },
  ],
}

function renderRow(overrides: Partial<Block> = {}) {
  const onOpenSpots = vi.fn()
  const onDelete = vi.fn()
  render(
    <RepertoireBlockRow
      block={{ ...block, ...overrides }}
      isFirst
      isLast
      onMove={vi.fn()}
      onDelete={onDelete}
      onOpenSpots={onOpenSpots}
    />,
  )
  return { onOpenSpots, onDelete }
}

describe('RepertoireBlockRow', () => {
  it('is one compact line: piece name and spot count, nothing else', () => {
    renderRow()

    expect(screen.getByText('Bruch Concerto')).toBeInTheDocument()
    expect(screen.getByText('2 spots')).toBeInTheDocument()
    // Spot names live in the drawer, not in the section list.
    expect(screen.queryByText('first page')).toBeNull()
  })

  it('singularizes a single spot', () => {
    renderRow({ default_spots: [block.default_spots![0]] })
    expect(screen.getByText('1 spot')).toBeInTheDocument()
  })

  it('says so when the block has no default spots yet', () => {
    renderRow({ default_spots: [] })
    expect(screen.getByText('No spots')).toBeInTheDocument()
  })

  it('opens the spot management drawer when the row is tapped', async () => {
    const user = userEvent.setup()
    const { onOpenSpots } = renderRow()

    await user.click(
      screen.getByRole('button', { name: 'Bruch Concerto 2 spots' }),
    )

    expect(onOpenSpots).toHaveBeenCalled()
  })

  it('keeps block-level actions in the overflow menu', async () => {
    const user = userEvent.setup()
    const { onDelete, onOpenSpots } = renderRow()

    await user.click(screen.getByRole('button', { name: 'Bruch Concerto actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))

    expect(onDelete).toHaveBeenCalled()
    expect(onOpenSpots).not.toHaveBeenCalled()
  })
})
