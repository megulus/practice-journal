'use client'

import type { PracticeDay, BlockType } from '@/lib/types'

interface PracticeBlockProps {
  day: PracticeDay
  blockTypes: BlockType[]
  onLogBlock?: (blockId: number) => void
  loggedBlockIds?: Set<number>
}

export default function PracticeBlock({ day, blockTypes, onLogBlock, loggedBlockIds }: PracticeBlockProps) {
  const sortedBlocks = [...day.exercise_blocks].sort(
    (a, b) => a.display_order - b.display_order
  )

  const getBlockLabel = (block: typeof sortedBlocks[0]) => {
    if (block.block_type_id) {
      const bt = blockTypes.find((t) => t.id === block.block_type_id)
      if (bt) return bt.label
    }
    // Fall back to slug match
    const bt = blockTypes.find((t) => t.slug === block.block_type)
    if (bt) return bt.label
    // Last resort: use block_type string
    return block.block_type
  }

  if (sortedBlocks.length === 0) {
    return (
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 border-l-4 border-primary-500">
        <h3 className="text-2xl font-bold text-gray-800 mb-6">{day.title}</h3>
        <p className="text-gray-500 italic">No blocks configured for this day.</p>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 border-l-4 border-primary-500">
      <h3 className="text-2xl font-bold text-gray-800 mb-6">{day.title}</h3>

      {sortedBlocks.map((block) => (
        <div key={block.id} className="mb-4">
          <div className="flex items-center justify-between mt-4 mb-2">
            <h4 className="text-lg font-semibold text-primary-600 flex items-center gap-2">
              {getBlockLabel(block)}
              {block.duration_minutes && (
                <span className="text-sm font-normal text-gray-500">
                  ({block.duration_minutes} min)
                </span>
              )}
              {loggedBlockIds?.has(block.id) && (
                <span className="text-green-500 text-sm font-medium flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Logged
                </span>
              )}
            </h4>
            {onLogBlock && (
              <button
                onClick={() => onLogBlock(block.id)}
                className="text-sm text-primary-600 hover:text-primary-800 font-medium px-3 py-1 rounded-lg hover:bg-primary-50 transition-colors"
              >
                Log this
              </button>
            )}
          </div>

          {block.exercises.length > 0 ? (
            <>
              <p className="text-gray-600 mb-2">Choose one:</p>
              <ul className="list-disc ml-6 space-y-1 mb-4">
                {[...block.exercises]
                  .sort((a, b) => a.display_order - b.display_order)
                  .map((exercise) => (
                    <li key={exercise.id} className="text-gray-700">
                      {exercise.exercise_text}
                    </li>
                  ))}
              </ul>
            </>
          ) : (
            <p className="text-gray-400 italic mb-4">(no exercises configured)</p>
          )}
        </div>
      ))}
    </div>
  )
}
