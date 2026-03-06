import { describe, it, expect, vi } from 'vitest'
import { render, screen, userEvent } from '@/test/utils'
import PracticeBlock from './PracticeBlock'
import type { PracticeDay, BlockType } from '@/lib/types'

const blockTypes: BlockType[] = [
  { id: 1, slug: 'warm-up', label: 'Warm-Up', default_duration_minutes: 10, display_order: 0 },
  { id: 2, slug: 'scales', label: 'Scales', default_duration_minutes: 15, display_order: 1 },
]

const day: PracticeDay = {
  id: 1,
  day_number: 1,
  title: 'Day 1',
  exercise_blocks: [
    {
      id: 10,
      block_type: 'warm-up',
      block_type_id: 1,
      duration_minutes: 10,
      display_order: 0,
      exercises: [
        { id: 100, exercise_text: 'Long tones', display_order: 0 },
        { id: 101, exercise_text: 'Lip slurs', display_order: 1 },
      ],
    },
    {
      id: 11,
      block_type: 'scales',
      block_type_id: 2,
      duration_minutes: 15,
      display_order: 1,
      exercises: [],
    },
  ],
}

describe('PracticeBlock', () => {
  it('renders day title and block labels', () => {
    render(<PracticeBlock day={day} blockTypes={blockTypes} />)
    expect(screen.getByText('Day 1')).toBeInTheDocument()
    expect(screen.getByText('Warm-Up')).toBeInTheDocument()
    expect(screen.getByText('Scales')).toBeInTheDocument()
  })

  it('renders exercises as list items', () => {
    render(<PracticeBlock day={day} blockTypes={blockTypes} />)
    expect(screen.getByText('Long tones')).toBeInTheDocument()
    expect(screen.getByText('Lip slurs')).toBeInTheDocument()
  })

  it('shows duration for blocks', () => {
    render(<PracticeBlock day={day} blockTypes={blockTypes} />)
    expect(screen.getByText('(10 min)')).toBeInTheDocument()
    expect(screen.getByText('(15 min)')).toBeInTheDocument()
  })

  it('shows empty message for blocks with no exercises', () => {
    render(<PracticeBlock day={day} blockTypes={blockTypes} />)
    expect(screen.getByText('(no exercises configured)')).toBeInTheDocument()
  })

  it('shows empty state when day has no blocks', () => {
    const emptyDay: PracticeDay = { ...day, exercise_blocks: [] }
    render(<PracticeBlock day={emptyDay} blockTypes={blockTypes} />)
    expect(screen.getByText('No blocks configured for this day.')).toBeInTheDocument()
  })

  it('shows "Log this" button when onLogBlock is provided', () => {
    render(<PracticeBlock day={day} blockTypes={blockTypes} onLogBlock={() => {}} />)
    expect(screen.getAllByText('Log this')).toHaveLength(2)
  })

  it('calls onLogBlock with block id when clicked', async () => {
    const onLogBlock = vi.fn()
    const user = userEvent.setup()

    render(<PracticeBlock day={day} blockTypes={blockTypes} onLogBlock={onLogBlock} />)
    const buttons = screen.getAllByText('Log this')
    await user.click(buttons[0])
    expect(onLogBlock).toHaveBeenCalledWith(10)
  })

  it('shows logged indicator for logged blocks', () => {
    const loggedIds = new Set([10])
    render(<PracticeBlock day={day} blockTypes={blockTypes} loggedBlockIds={loggedIds} />)
    expect(screen.getByText('Logged')).toBeInTheDocument()
  })

  it('falls back to block_type string when no matching block type', () => {
    const dayWithUnknown: PracticeDay = {
      ...day,
      exercise_blocks: [
        { id: 20, block_type: 'custom-type', display_order: 0, exercises: [] },
      ],
    }
    render(<PracticeBlock day={dayWithUnknown} blockTypes={blockTypes} />)
    expect(screen.getByText('custom-type')).toBeInTheDocument()
  })
})
