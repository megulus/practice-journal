'use client'

import type { Block } from '@/lib/types'
import { AutoSaveInput } from './ui'
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

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 last:border-b-0">
      {/* Reorder chevrons */}
      <div className="flex flex-col shrink-0">
        <button
          type="button"
          disabled={isFirst}
          onClick={() => onMove('up')}
          className="w-9 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 disabled:opacity-25 disabled:cursor-not-allowed text-xs touch-manipulation"
          aria-label="Move up"
        >
          ▲
        </button>
        <button
          type="button"
          disabled={isLast}
          onClick={() => onMove('down')}
          className="w-9 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 disabled:opacity-25 disabled:cursor-not-allowed text-xs touch-manipulation"
          aria-label="Move down"
        >
          ▼
        </button>
      </div>

      {/* Name */}
      <AutoSaveInput
        value={block.name ?? block.piece_name ?? ''}
        onCommit={onRename}
        disabled={isRepertoire}
        placeholder="Block name"
        className="flex-1 min-w-0 bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none disabled:text-gray-500"
      />

      {/* Time stepper */}
      <TimeStepper
        value={block.estimated_duration_minutes ?? 0}
        onChange={onDurationChange}
      />

      {/* Delete */}
      <button
        type="button"
        onClick={onDelete}
        className="shrink-0 w-9 h-9 flex items-center justify-center text-gray-300 hover:text-red-500 text-sm touch-manipulation"
        aria-label="Remove block"
      >
        ✕
      </button>
    </div>
  )
}
