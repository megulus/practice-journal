import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, userEvent } from '@/test/utils'
import { BlockRow } from './BlockRow'
import type { BlockLog } from '@/lib/types'

const { mockUpdateBlockLog } = vi.hoisted(() => ({
  mockUpdateBlockLog: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/useApi', () => ({
  useApi: () => ({ updateBlockLog: mockUpdateBlockLog }),
}))

function makeLog(overrides: Partial<BlockLog> = {}): BlockLog {
  return {
    id: 7,
    block_id: null,
    spot_id: null,
    block_name: 'Scales',
    rating: null,
    notes: null,
    completed: false,
    display_order: 0,
    tempo_bpm: null,
    last_tempo_bpm: null,
    piece_name: null,
    ...overrides,
  }
}

function makeFlushRef() {
  return { current: new Set<() => Promise<void>>() }
}

describe('BlockRow', () => {
  beforeEach(() => {
    mockUpdateBlockLog.mockClear()
  })

  it('marks the block complete when the checkbox is clicked', async () => {
    const onUpdate = vi.fn()
    const user = userEvent.setup()
    render(
      <BlockRow
        logId={1}
        blockLog={makeLog()}
        onUpdate={onUpdate}
        pendingFlushes={makeFlushRef()}
      />
    )

    await user.click(screen.getByRole('checkbox', { name: 'Mark complete' }))
    expect(mockUpdateBlockLog).toHaveBeenCalledExactlyOnceWith(1, 7, {
      completed: true,
    })
    expect(onUpdate).toHaveBeenCalledOnce()
  })

  it('sets a rating and marks complete when a chevron is clicked', async () => {
    const onUpdate = vi.fn()
    const user = userEvent.setup()
    render(
      <BlockRow
        logId={1}
        blockLog={makeLog()}
        onUpdate={onUpdate}
        pendingFlushes={makeFlushRef()}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Step forward' }))
    expect(mockUpdateBlockLog).toHaveBeenCalledExactlyOnceWith(1, 7, {
      rating: 1,
      completed: true,
    })
    expect(onUpdate).toHaveBeenCalledOnce()
  })

  it('registers a pending flush while an edited note is unsaved', async () => {
    const flushRef = makeFlushRef()
    const user = userEvent.setup()
    render(
      <BlockRow
        logId={1}
        blockLog={makeLog()}
        onUpdate={vi.fn()}
        pendingFlushes={flushRef}
      />
    )

    await user.click(screen.getByRole('button', { name: '+ add note' }))
    await user.type(screen.getByPlaceholderText('Notes...'), 'tricky shift')
    expect(flushRef.current.size).toBe(1)
  })
})

describe('BlockRow — in-the-moment suggestion (#180)', () => {
  it('renders a hint card below the row when a suggestion is given', () => {
    render(
      <BlockRow
        logId={1}
        blockLog={makeLog()}
        suggestion={{
          rule_id: 'note_recall',
          text: 'Last session you noted intonation was shaky up top.',
        }}
        onUpdate={vi.fn()}
        pendingFlushes={makeFlushRef()}
      />
    )

    const hint = screen.getByRole('note')
    expect(hint).toHaveTextContent(
      'Last session you noted intonation was shaky up top.'
    )
    // Hint card tokens — design-tokens §6 (Cards, Hint card variant)
    expect(hint).toHaveClass(
      'bg-input-bg-recessed',
      'border-l-2',
      'border-border-input',
      'rounded-md',
      'text-text-secondary'
    )
  })

  it('renders no hint card when there is no suggestion for the block', () => {
    render(
      <BlockRow
        logId={1}
        blockLog={makeLog()}
        onUpdate={vi.fn()}
        pendingFlushes={makeFlushRef()}
      />
    )
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })
})
