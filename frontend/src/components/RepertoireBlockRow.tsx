'use client'

import { ArrowUp, ArrowDown, Trash2 } from 'lucide-react'
import type { Block } from '@/lib/types'
import { Menu, type MenuItem } from './ui'

/**
 * A repertoire block in the section editor's block list: one compact line with
 * the piece name and its default-spot count. Tapping the row opens the spot
 * management drawer — spot configuration has a single canonical surface, and
 * the section list stays scannable no matter how many pieces are in it
 * (repertoire doc, "The repertoire block in the section list").
 */
export default function RepertoireBlockRow({
  block,
  isFirst,
  isLast,
  onMove,
  onDelete,
  onOpenSpots,
}: {
  block: Block
  isFirst: boolean
  isLast: boolean
  onMove: (direction: 'up' | 'down') => void
  onDelete: () => void
  onOpenSpots: () => void
}) {
  const count = block.default_spots?.length ?? 0
  const pieceName = block.piece_name ?? 'Piece'

  const menuItems: MenuItem[] = [
    {
      label: 'Move up',
      icon: <ArrowUp size={14} />,
      onSelect: () => onMove('up'),
      disabled: isFirst,
    },
    {
      label: 'Move down',
      icon: <ArrowDown size={14} />,
      onSelect: () => onMove('down'),
      disabled: isLast,
    },
    {
      label: 'Delete',
      icon: <Trash2 size={14} />,
      onSelect: onDelete,
      destructive: true,
    },
  ]

  return (
    <div className="flex items-center gap-2 border-b border-border-subtle px-3 py-2 last:border-b-0">
      <button
        type="button"
        onClick={onOpenSpots}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-md py-0.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <span className="min-w-0 flex-1 truncate text-sm text-text-primary">
          {pieceName}
        </span>
        <span className="shrink-0 text-xs text-text-tertiary">
          {count === 0 ? 'No spots' : count === 1 ? '1 spot' : `${count} spots`}
        </span>
      </button>

      <Menu triggerLabel={`${pieceName} actions`} items={menuItems} />
    </div>
  )
}
