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
    last_tempo_bpm: null,
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
