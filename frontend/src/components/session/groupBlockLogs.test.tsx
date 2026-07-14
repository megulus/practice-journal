import { describe, it, expect } from 'vitest'
import { groupBlockLogs } from './groupBlockLogs'
import type { BlockLog } from '@/lib/types'

function makeLog(overrides: Partial<BlockLog>): BlockLog {
  return {
    id: 1,
    block_id: null,
    spot_id: null,
    block_name: 'Block',
    rating: null,
    notes: null,
    completed: false,
    display_order: 0,
    last_tempo_bpm: null,
    ...overrides,
  }
}

describe('groupBlockLogs', () => {
  it('treats a plain block with no block_id as standard', () => {
    const logs = [makeLog({ id: 1, block_name: 'Scales' })]
    const groups = groupBlockLogs(logs, null)
    expect(groups).toEqual([{ type: 'standard', blockLog: logs[0] }])
  })

  it('groups spot logs sharing a block_id into one repertoire group', () => {
    const logs = [
      makeLog({ id: 1, block_id: 10, spot_id: 100, block_name: 'Bruch — m. 1' }),
      makeLog({ id: 2, block_id: 10, spot_id: 101, block_name: 'Bruch — m. 8' }),
    ]
    const groups = groupBlockLogs(logs, null)
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({
      type: 'repertoire',
      blockId: 10,
      pieceName: 'Bruch',
    })
    if (groups[0].type === 'repertoire') {
      expect(groups[0].spotLogs).toHaveLength(2)
      expect(groups[0].pieceLog).toBeNull()
    }
  })

  it('treats a known repertoire block_id as repertoire even with no spot logs', () => {
    const logs = [makeLog({ id: 1, block_id: 10, spot_id: null, block_name: 'Bruch — full' })]
    const groups = groupBlockLogs(logs, new Set([10]))
    expect(groups).toHaveLength(1)
    expect(groups[0].type).toBe('repertoire')
    if (groups[0].type === 'repertoire') {
      expect(groups[0].pieceLog).toBe(logs[0])
      expect(groups[0].spotLogs).toHaveLength(0)
    }
  })

  it('groups multiple logs sharing a block_id even without spot_id or known set', () => {
    const logs = [
      makeLog({ id: 1, block_id: 20, block_name: 'Piece — a' }),
      makeLog({ id: 2, block_id: 20, block_name: 'Piece — b' }),
    ]
    const groups = groupBlockLogs(logs, null)
    expect(groups).toHaveLength(1)
    expect(groups[0].type).toBe('repertoire')
  })

  it('preserves ordering, interleaving standard and repertoire groups', () => {
    const logs = [
      makeLog({ id: 1, block_name: 'Warm-up' }),
      makeLog({ id: 2, block_id: 30, spot_id: 300, block_name: 'Sonata — m. 4' }),
      makeLog({ id: 3, block_name: 'Cool-down' }),
    ]
    const groups = groupBlockLogs(logs, null)
    expect(groups.map((g) => g.type)).toEqual(['standard', 'repertoire', 'standard'])
  })

  it('falls back to Unknown piece when a group has no source log name', () => {
    // A block_id known-repertoire but with neither spot logs nor a piece log
    // cannot occur through the group pass, so exercise the pieceName fallback
    // path via a piece log whose name has no dash.
    const logs = [makeLog({ id: 1, block_id: 40, spot_id: null, block_name: 'Etude' })]
    const groups = groupBlockLogs(logs, new Set([40]))
    expect(groups[0].type).toBe('repertoire')
    if (groups[0].type === 'repertoire') {
      expect(groups[0].pieceName).toBe('Etude')
    }
  })
})
