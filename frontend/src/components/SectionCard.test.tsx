import { describe, it, expect, vi } from 'vitest'
import { render, screen, userEvent } from '@/test/utils'
import type { Block, Section } from '@/lib/types'
import { getSectionColor } from '@/lib/section-colors'
import SectionCard from './SectionCard'

const baseBlock: Omit<Block, 'id' | 'name' | 'piece_id' | 'piece_name'> = {
  description: null,
  estimated_duration_minutes: 10,
  tempo_bpm: null,
  key: null,
  difficulty_level: null,
  display_order: 0,
  curated_block_id: null,
  default_spots: null,
}

const section: Section = {
  id: 1,
  name: 'Repertoire',
  section_type: 'repertoire',
  estimated_duration_minutes: 20,
  display_order: 0,
  blocks: [
    { ...baseBlock, id: 1, name: 'Scales', piece_id: null, piece_name: null },
    {
      ...baseBlock,
      id: 2,
      name: null,
      piece_id: 5,
      piece_name: 'Bruch Concerto',
      display_order: 1,
      default_spots: [
        { id: 9, name: 'first page', location: null, display_order: 0 },
      ],
    },
  ],
}

describe('SectionCard', () => {
  it('routes repertoire blocks to the compact row and standard blocks to the editable one', async () => {
    const user = userEvent.setup()
    const onOpenBlockSpots = vi.fn()

    render(
      <SectionCard
        section={section}
        color={getSectionColor('repertoire', 0)}
        isFirst
        isLast
        onMove={vi.fn()}
        onRename={vi.fn()}
        onDurationChange={vi.fn()}
        onDelete={vi.fn()}
        onAddBlock={vi.fn()}
        onMoveBlock={vi.fn()}
        onRenameBlock={vi.fn()}
        onChangeBlockDuration={vi.fn()}
        onDeleteBlock={vi.fn()}
        onOpenBlockSpots={onOpenBlockSpots}
      />,
    )

    // Standard block keeps its rename field and time stepper.
    expect(screen.getByDisplayValue('Scales')).toBeInTheDocument()

    // Repertoire block is a tappable one-liner instead.
    expect(screen.queryByDisplayValue('Bruch Concerto')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Bruch Concerto 1 spot' }))

    expect(onOpenBlockSpots).toHaveBeenCalledWith(2)
  })
})
