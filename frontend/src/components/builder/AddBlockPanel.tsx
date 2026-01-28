'use client'

import type { BlockType } from '@/lib/types'

interface AddBlockPanelProps {
  blockTypes: BlockType[]
  onAddBlock: (blockTypeId: number) => void
}

export default function AddBlockPanel({ blockTypes, onAddBlock }: AddBlockPanelProps) {
  if (blockTypes.length === 0) return null

  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Add a Block
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {[...blockTypes]
          .sort((a, b) => a.display_order - b.display_order)
          .map((bt) => (
            <button
              key={bt.id}
              onClick={() => onAddBlock(bt.id)}
              className="p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-primary-50 hover:border-primary-300 transition-colors text-left"
            >
              <div className="font-medium text-gray-800 text-sm">{bt.label}</div>
              {bt.description && (
                <div className="text-xs text-gray-500 mt-1">{bt.description}</div>
              )}
              <div className="text-xs text-gray-400 mt-1">
                {bt.default_duration_minutes} min
              </div>
            </button>
          ))}
      </div>
    </div>
  )
}
