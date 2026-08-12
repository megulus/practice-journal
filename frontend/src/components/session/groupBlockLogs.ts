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
        const pieceName = derivePieceName([
          ...group.spotLogs,
          ...(group.pieceLog ? [group.pieceLog] : []),
        ])
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

/**
 * The display name for a repertoire group.
 *
 * `piece_name` comes from the block relationship (block_id → Block.piece_id →
 * Piece.name) and is the only source that survives a title containing the
 * " — " separator: `block_name` is denormalized as "{piece} — {spot}", so a
 * piece called "Sonata — No. 2" produces "Sonata — No. 2 — mm. 1–8" and no
 * parsing rule can tell where the title ends.
 *
 * The split survives only as a fallback for groups whose logs carry no
 * `piece_name` — the heuristics above can group logs that aren't repertoire
 * at all (several sharing one block_id), and a response cached from before
 * the field existed carries none.
 */
function derivePieceName(logs: BlockLog[]): string {
  const named = logs.find((bl) => bl.piece_name)
  if (named?.piece_name) return named.piece_name
  const first = logs[0]
  return first ? first.block_name.split(' — ')[0] : 'Unknown piece'
}

/**
 * Repertoire spot logs are named "{piece} — {spot}"; a spot row already sits
 * under its piece, so drop the prefix.
 *
 * Strips the group's actual piece name rather than splitting on the first
 * " — ", so a title containing the separator loses only the title, and a name
 * that doesn't carry the expected prefix is left intact.
 */
export function spotDisplayName(blockLog: BlockLog, pieceName: string): string {
  const prefix = `${pieceName} — `
  return blockLog.block_name.startsWith(prefix)
    ? blockLog.block_name.slice(prefix.length)
    : blockLog.block_name
}
