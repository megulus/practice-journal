'use client'

import { ArrowUp, ArrowDown, Trash2 } from 'lucide-react'
import type { Block } from '@/lib/types'
import { AutoSaveInput, Menu, type MenuItem } from './ui'
import TimeStepper from './ui/TimeStepper'

/**
 * Standard (non-repertoire) block row in the template editor.
 *
 * Repertoire blocks (piece_id != null) are rendered by a separate component
 * landing in #167 — for now this row falls back to displaying piece_name if it
 * encounters one, but does not attempt the spot-management drawer.
 */
export default function BlockRow({
  block,
  isFirst,
  isLast,
  onMove,
  onRename,
  onDurationChange,
  onDelete,
}: {
  block: Block
  isFirst: boolean
  isLast: boolean
  onMove: (direction: 'up' | 'down') => void
  onRename: (name: string) => void
  onDurationChange: (minutes: number) => void
  onDelete: () => void
}) {
  const isRepertoire = block.piece_id != null

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
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle last:border-b-0">
      {/* Name */}
      <AutoSaveInput
        value={block.name ?? block.piece_name ?? ''}
        onCommit={onRename}
        disabled={isRepertoire}
        placeholder="Block name"
        className="flex-1 min-w-0 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none disabled:text-text-tertiary"
      />

      {/* Time stepper */}
      <TimeStepper
        value={block.estimated_duration_minutes ?? 0}
        onChange={onDurationChange}
      />

      {/* Overflow menu (reorder + delete) */}
      <Menu triggerLabel="Block actions" items={menuItems} />
    </div>
  )
}
