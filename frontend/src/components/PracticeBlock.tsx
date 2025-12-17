'use client'

import type { PracticeDay } from '@/lib/types'

interface PracticeBlockProps {
  day: PracticeDay
}

export default function PracticeBlock({ day }: PracticeBlockProps) {
  const blockA = day.exercise_blocks.find(b => b.block_type === 'blockA')
  const blockB = day.exercise_blocks.find(b => b.block_type === 'blockB')

  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 border-l-4 border-primary-500">
      <h3 className="text-2xl font-bold text-gray-800 mb-6">{day.title}</h3>

      {day.warmup && (
        <>
          <h4 className="text-lg font-semibold text-primary-600 mt-4 mb-2">⏰ Warm-up (5 min)</h4>
          <p className="text-gray-700 mb-4">{day.warmup}</p>
        </>
      )}

      {day.scales && (
        <>
          <h4 className="text-lg font-semibold text-primary-600 mt-4 mb-2">🎵 Scales & Arpeggios (8-12 min)</h4>
          <p className="text-gray-700 mb-4">{day.scales}</p>
        </>
      )}

      {blockA && blockA.exercises.length > 0 && (
        <>
          <h4 className="text-lg font-semibold text-primary-600 mt-4 mb-2">🎯 Technical Focus A (12 min)</h4>
          <p className="text-gray-600 mb-2">Choose one:</p>
          <ul className="list-disc ml-6 space-y-1 mb-4">
            {blockA.exercises
              .sort((a, b) => a.display_order - b.display_order)
              .map((exercise) => (
                <li key={exercise.id} className="text-gray-700">
                  {exercise.exercise_text}
                </li>
              ))}
          </ul>
        </>
      )}

      {blockB && blockB.exercises.length > 0 && (
        <>
          <h4 className="text-lg font-semibold text-primary-600 mt-4 mb-2">
            🎯 Technical Focus B (10 min - skip if 30-min day)
          </h4>
          <p className="text-gray-600 mb-2">Choose one:</p>
          <ul className="list-disc ml-6 space-y-1 mb-4">
            {blockB.exercises
              .sort((a, b) => a.display_order - b.display_order)
              .map((exercise) => (
                <li key={exercise.id} className="text-gray-700">
                  {exercise.exercise_text}
                </li>
              ))}
          </ul>
        </>
      )}

      {day.repertoire && (
        <>
          <h4 className="text-lg font-semibold text-primary-600 mt-4 mb-2">🎼 Repertoire Focus (7-20 min)</h4>
          <p className="text-gray-700">{day.repertoire}</p>
        </>
      )}
    </div>
  )
}


