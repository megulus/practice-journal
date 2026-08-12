import { describe, it, expect } from 'vitest'
import { groupBlockLogs, spotDisplayName } from './groupBlockLogs'
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
    tempo_bpm: null,
    last_tempo_bpm: null,
    piece_name: null,
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

describe('groupBlockLogs — piece name from the relationship (#274)', () => {
  it('keeps a title containing the separator whole', () => {
    const logs = [
      makeLog({
        id: 1,
        block_id: 10,
        spot_id: 100,
        block_name: 'Sonata — No. 2 — mm. 1–8',
        piece_name: 'Sonata — No. 2',
      }),
      makeLog({
        id: 2,
        block_id: 10,
        spot_id: 101,
        block_name: 'Sonata — No. 2 — coda',
        piece_name: 'Sonata — No. 2',
      }),
    ]
    const groups = groupBlockLogs(logs, null)
    expect(groups[0]).toMatchObject({
      type: 'repertoire',
      pieceName: 'Sonata — No. 2',
    })
  })

  it('prefers piece_name over the block_name prefix when they disagree', () => {
    // The piece was renamed after the log was written; the relationship is
    // the current truth, the denormalized string is the historical one.
    const logs = [
      makeLog({
        id: 1,
        block_id: 10,
        spot_id: 100,
        block_name: 'Old title — mm. 1–8',
        piece_name: 'New title',
      }),
      makeLog({
        id: 2,
        block_id: 10,
        spot_id: 101,
        block_name: 'Old title — coda',
        piece_name: 'New title',
      }),
    ]
    const groups = groupBlockLogs(logs, null)
    expect(groups[0]).toMatchObject({ pieceName: 'New title' })
    // …and the rows still drop the prefix they were written with, rather
    // than showing the stale title back to the user.
    if (groups[0].type === 'repertoire') {
      const { spotLogs, pieceName } = groups[0]
      expect(spotLogs.map((bl) => spotDisplayName(bl, pieceName, spotLogs)))
        .toEqual(['mm. 1–8', 'coda'])
    }
  })

  it('takes the piece name from whichever log in the group carries one', () => {
    const logs = [
      makeLog({ id: 1, block_id: 10, spot_id: 100, block_name: 'A — one' }),
      makeLog({
        id: 2,
        block_id: 10,
        spot_id: 101,
        block_name: 'A — two',
        piece_name: 'Aria — da capo',
      }),
    ]
    const groups = groupBlockLogs(logs, null)
    expect(groups[0]).toMatchObject({ pieceName: 'Aria — da capo' })
  })

  it('falls back to the block_name split when no log carries a piece_name', () => {
    // The grouping heuristics can catch logs the server didn't resolve a
    // piece for, and a response cached from before the field existed has none.
    const logs = [
      makeLog({ id: 1, block_id: 10, spot_id: 100, block_name: 'Bruch — mm. 1–8' }),
      makeLog({ id: 2, block_id: 10, spot_id: 101, block_name: 'Bruch — coda' }),
    ]
    const groups = groupBlockLogs(logs, null)
    expect(groups[0]).toMatchObject({ pieceName: 'Bruch' })
  })
})

describe('spotDisplayName', () => {
  it('drops a piece prefix that itself contains the separator', () => {
    const log = makeLog({
      block_name: 'Sonata — No. 2 — mm. 1–8',
      piece_name: 'Sonata — No. 2',
    })
    expect(spotDisplayName(log, 'Sonata — No. 2')).toBe('mm. 1–8')
  })

  it('leaves a name that lacks the prefix intact', () => {
    const log = makeLog({ block_name: 'Coda, from the top — slowly' })
    const group = [makeLog({ block_name: 'Bruch concerto — mm. 1–16' }), log]
    expect(spotDisplayName(log, 'Bruch concerto', group)).toBe(
      'Coda, from the top — slowly',
    )
  })

  it('drops the stale prefix a renamed piece left in block_name', () => {
    const group = [
      makeLog({ block_name: 'Old title — mm. 1–8', piece_name: 'New title' }),
      makeLog({ block_name: 'Old title — coda', piece_name: 'New title' }),
    ]
    expect(spotDisplayName(group[0], 'New title', group)).toBe('mm. 1–8')
  })

  it('recovers a stale title that contains the separator', () => {
    // The logs agree on "Sonata — No. 2 — ", so the whole stale title goes,
    // which no split on the first " — " could manage.
    const group = [
      makeLog({
        block_name: 'Sonata — No. 2 — mm. 1–8',
        piece_name: 'Sonata No. 2',
      }),
      makeLog({
        block_name: 'Sonata — No. 2 — coda',
        piece_name: 'Sonata No. 2',
      }),
    ]
    expect(spotDisplayName(group[0], 'Sonata No. 2', group)).toBe('mm. 1–8')
  })

  it('trims the shared prefix back to a separator boundary', () => {
    // Spot names that start alike ("mm. 1–8" / "mm. 17–32") share more than
    // the title, so the common prefix has to be cut at the last " — ".
    const group = [
      makeLog({ block_name: 'Old title — mm. 1–8', piece_name: 'New title' }),
      makeLog({ block_name: 'Old title — mm. 17–32', piece_name: 'New title' }),
    ]
    expect(spotDisplayName(group[1], 'New title', group)).toBe('mm. 17–32')
  })

  it('falls back to the log itself when the group has one spot', () => {
    const log = makeLog({
      block_name: 'Old title — mm. 1–8',
      piece_name: 'New title',
    })
    expect(spotDisplayName(log, 'New title', [log])).toBe('mm. 1–8')
  })
})
