'use client'

import { useState } from 'react'
import type { Section } from '@/lib/types'
import BlockRow from './BlockRow'

export default function SectionCard({
  section,
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
}: {
  section: Section
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
}) {
  const [name, setName] = useState(section.name)
  const [duration, setDuration] = useState(
    String(section.estimated_duration_minutes)
  )

  const handleNameBlur = () => {
    const trimmed = name.trim()
    if (trimmed && trimmed !== section.name) onRename(trimmed)
    else if (!trimmed) setName(section.name)
  }

  const handleDurationBlur = () => {
    const parsed = Math.max(0, parseInt(duration, 10) || 0)
    if (parsed !== section.estimated_duration_minutes) onDurationChange(parsed)
    setDuration(String(parsed))
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 mb-3 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex flex-col gap-0.5 shrink-0">
          <button
            type="button"
            disabled={isFirst}
            onClick={() => onMove('up')}
            className="w-5 h-3 flex items-center justify-center text-gray-400 hover:text-gray-700 disabled:opacity-25 disabled:cursor-not-allowed text-xs"
            aria-label="Move section up"
          >
            ▲
          </button>
          <button
            type="button"
            disabled={isLast}
            onClick={() => onMove('down')}
            className="w-5 h-3 flex items-center justify-center text-gray-400 hover:text-gray-700 disabled:opacity-25 disabled:cursor-not-allowed text-xs"
            aria-label="Move section down"
          >
            ▼
          </button>
        </div>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleNameBlur}
          placeholder="Section name"
          className="flex-1 min-w-0 bg-transparent text-sm font-medium text-gray-800 placeholder-gray-400 focus:outline-none"
        />
        <input
          type="number"
          min={0}
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          onBlur={handleDurationBlur}
          className="w-12 bg-transparent text-sm text-gray-500 text-right tabular-nums focus:outline-none"
          aria-label="Section duration in minutes"
        />
        <span className="text-xs text-gray-400">min</span>
        <button
          type="button"
          onClick={onDelete}
          className="shrink-0 w-6 h-6 flex items-center justify-center text-gray-300 hover:text-red-500 text-sm"
          aria-label="Remove section"
        >
          ✕
        </button>
      </div>

      {/* Blocks */}
      {section.blocks.length === 0 ? (
        <p className="px-4 py-3 text-xs text-gray-400 italic">No blocks yet.</p>
      ) : (
        <ul>
          {section.blocks.map((b, i) => (
            <li key={b.id}>
              <BlockRow
                block={b}
                isFirst={i === 0}
                isLast={i === section.blocks.length - 1}
                onMove={(dir) => onMoveBlock(b.id, dir)}
                onRename={(name) => onRenameBlock(b.id, name)}
                onDurationChange={(min) => onChangeBlockDuration(b.id, min)}
                onDelete={() => onDeleteBlock(b.id)}
              />
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={onAddBlock}
        className="w-full py-2.5 text-sm text-primary-600 border-t border-gray-100 hover:bg-gray-50"
      >
        + Add block
      </button>
    </section>
  )
}
