'use client'

import { ArrowUp, ArrowDown, Trash2 } from 'lucide-react'
import type { Section } from '@/lib/types'
import type { SectionColor } from '@/lib/section-colors'
import { AutoSaveInput, Menu, SectionPip, useAutoSaveField, type MenuItem } from './ui'
import BlockRow from './BlockRow'
import RepertoireBlockRow from './RepertoireBlockRow'

export default function SectionCard({
  section,
  color,
  isFirst,
  isLast,
  onMove,
  onRename,
  onDurationChange,
  onDelete,
  onAddBlock,
  onMoveBlock,
  onRenameBlock,
  onChangeBlockDuration,
  onDeleteBlock,
  onOpenBlockSpots,
}: {
  section: Section
  color: SectionColor
  isFirst: boolean
  isLast: boolean
  onMove: (direction: 'up' | 'down') => void
  onRename: (name: string) => void
  onDurationChange: (minutes: number) => void
  onDelete: () => void
  onAddBlock: () => void
  onMoveBlock: (blockId: number, direction: 'up' | 'down') => void
  onRenameBlock: (blockId: number, name: string) => void
  onChangeBlockDuration: (blockId: number, minutes: number) => void
  onDeleteBlock: (blockId: number) => void
  /** Opens the spot management drawer for a repertoire block. */
  onOpenBlockSpots: (blockId: number) => void
}) {
  const duration = useAutoSaveField<number>({
    value: section.estimated_duration_minutes,
    onCommit: onDurationChange,
    parse: (s) => Math.max(0, parseInt(s, 10) || 0),
    rollbackWhenEmpty: false,
  })

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
    <section className="bg-card-bg rounded-xl border border-border-default mb-3 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-card-bg-inset border-b border-border-default">
        <SectionPip color={color} size={10} />
        <AutoSaveInput
          value={section.name}
          onCommit={onRename}
          placeholder="Section name"
          className="flex-1 min-w-0 bg-transparent text-sm font-medium text-text-primary placeholder:text-text-tertiary focus:outline-none"
        />
        <input
          type="number"
          min={0}
          value={duration.value}
          onChange={duration.onChange}
          onFocus={duration.onFocus}
          onBlur={duration.onBlur}
          className="w-12 bg-transparent text-sm text-text-secondary text-right tabular-nums focus:outline-none"
          aria-label="Section duration in minutes"
        />
        <span className="text-xs text-text-tertiary">min</span>
        <Menu triggerLabel="Section actions" items={menuItems} />
      </div>

      {/* Blocks */}
      {section.blocks.length === 0 ? (
        <p className="px-4 py-3 text-xs text-text-tertiary italic">
          No blocks yet.
        </p>
      ) : (
        <ul>
          {section.blocks.map((b, i) => (
            <li key={b.id}>
              {b.piece_id != null ? (
                <RepertoireBlockRow
                  block={b}
                  isFirst={i === 0}
                  isLast={i === section.blocks.length - 1}
                  onMove={(dir) => onMoveBlock(b.id, dir)}
                  onDelete={() => onDeleteBlock(b.id)}
                  onOpenSpots={() => onOpenBlockSpots(b.id)}
                />
              ) : (
                <BlockRow
                  block={b}
                  isFirst={i === 0}
                  isLast={i === section.blocks.length - 1}
                  onMove={(dir) => onMoveBlock(b.id, dir)}
                  onRename={(name) => onRenameBlock(b.id, name)}
                  onDurationChange={(min) => onChangeBlockDuration(b.id, min)}
                  onDelete={() => onDeleteBlock(b.id)}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={onAddBlock}
        className="w-full py-2.5 text-sm text-text-link border-t border-border-subtle hover:bg-card-bg-inset"
      >
        + Add block
      </button>
    </section>
  )
}
