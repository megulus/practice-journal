import type { BlockLog } from '@/lib/types'

// ---------------------------------------------------------------------------
// Block log grouping — identifies repertoire blocks (shared block_id +
// spot_id set) and groups them for rendering as a RepertoireBlock.
// ---------------------------------------------------------------------------

export type BlockGroup =
  | { type: 'standard'; blockLog: BlockLog }
  | {
      type: 'repertoire'
      blockId: number
      pieceName: string
      spotLogs: BlockLog[]
      pieceLog: BlockLog | null
    }

export function groupBlockLogs(
  blockLogs: BlockLog[],
  knownRepertoireBlockIds: Set<number> | null,
): BlockGroup[] {
  const groups: BlockGroup[] = []
  const repGroups = new Map<
    number,
    { spotLogs: BlockLog[]; pieceLog: BlockLog | null }
  >()

  // A block is repertoire if:
  // - it has spot_id set (per-spot log), OR
  // - its block_id is in the known-repertoire set (survives collapse), OR
  // - multiple logs share the same block_id (multi-spot in this render)
  const blockIdCounts = new Map<number, number>()
  for (const bl of blockLogs) {
    if (bl.block_id !== null) {
      blockIdCounts.set(bl.block_id, (blockIdCounts.get(bl.block_id) ?? 0) + 1)
    }
  }

  const isRepertoire = (bl: BlockLog): boolean => {
    if (bl.spot_id !== null) return true
    if (bl.block_id !== null && knownRepertoireBlockIds?.has(bl.block_id)) return true
    if (bl.block_id !== null && (blockIdCounts.get(bl.block_id) ?? 0) > 1) return true
    return false
  }

  // Group pass
  const seen = new Set<number>()
  for (const bl of blockLogs) {
    if (bl.block_id !== null && isRepertoire(bl)) {
      if (!seen.has(bl.block_id)) {
        seen.add(bl.block_id)
        repGroups.set(bl.block_id, { spotLogs: [], pieceLog: null })
      }
      const group = repGroups.get(bl.block_id)!
      if (bl.spot_id !== null) {
        group.spotLogs.push(bl)
      } else {
        group.pieceLog = bl
      }
    }
  }

  // Third pass: build output in order, replacing repertoire logs with groups
  const emitted = new Set<number>()
  for (const bl of blockLogs) {
    if (bl.block_id !== null && repGroups.has(bl.block_id)) {
      if (!emitted.has(bl.block_id)) {
        emitted.add(bl.block_id)
        const group = repGroups.get(bl.block_id)!
        // Extract piece name from the first spot log or piece log
        const firstLog = group.spotLogs[0] ?? group.pieceLog
        const pieceName = firstLog
          ? firstLog.block_name.split(' — ')[0]
          : 'Unknown piece'
        groups.push({
          type: 'repertoire',
          blockId: bl.block_id,
          pieceName,
          spotLogs: group.spotLogs,
          pieceLog: group.pieceLog,
        })
      }
    } else {
      groups.push({ type: 'standard', blockLog: bl })
    }
  }

  return groups
}
