'use client'

import type { PracticeDay, BlockType } from '@/lib/types'

interface PracticeBlockProps {
  day: PracticeDay
  blockTypes: BlockType[]
}

export default function PracticeBlock({ day, blockTypes }: PracticeBlockProps) {
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
          <h4 className="text-lg font-semibold text-primary-600 mt-4 mb-2">
            {getBlockLabel(block)}
            {block.duration_minutes && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({block.duration_minutes} min)
              </span>
            )}
          </h4>

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
