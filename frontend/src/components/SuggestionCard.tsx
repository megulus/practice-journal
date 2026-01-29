'use client'

import type { Suggestion } from '@/lib/types'

interface SuggestionCardProps {
  suggestion: Suggestion
  onAccept?: () => void
  onDismiss?: () => void
  onNotYet?: () => void
  showExerciseName?: boolean
  compact?: boolean
}

const typeStyles: Record<string, { icon: string; bgColor: string; borderColor: string }> = {
  tempo_increase: {
    icon: '🚀',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  tempo_decrease: {
    icon: '🐢',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
  revisit: {
    icon: '🔄',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
  },
  advance: {
    icon: '⭐',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
  },
  new_variation: {
    icon: '💪',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
  },
  new_key: {
    icon: '🎵',
    bgColor: 'bg-pink-50',
    borderColor: 'border-pink-200',
  },
}

export default function SuggestionCard({
  suggestion,
  onAccept,
  onDismiss,
  onNotYet,
  showExerciseName = true,
  compact = false,
}: SuggestionCardProps) {
  const style = typeStyles[suggestion.type] || typeStyles.new_variation

  if (compact) {
    return (
      <div
        className={`${style.bgColor} ${style.borderColor} border rounded-lg p-3`}
      >
        <div className="flex items-start gap-2">
          <span className="text-lg">{style.icon}</span>
          <div className="flex-1 min-w-0">
            {showExerciseName && (
              <p className="text-sm font-medium text-gray-700 truncate">
                {suggestion.exercise_text}
              </p>
            )}
            <p className="text-sm text-gray-600">{suggestion.message}</p>
          </div>
        </div>
        <div className="flex gap-2 mt-2 ml-7">
          {suggestion.action && onAccept && (
            <button
              onClick={onAccept}
              className="text-xs px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 font-medium"
            >
              Accept
            </button>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-xs px-2 py-1 text-gray-500 hover:text-gray-700"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`${style.bgColor} ${style.borderColor} border-2 rounded-xl p-4`}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">{style.icon}</span>
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500 mb-1">Suggestion</p>
          {showExerciseName && (
            <p className="font-semibold text-gray-800 mb-2">
              {suggestion.exercise_text}
            </p>
          )}
          <p className="text-gray-700">{suggestion.message}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-4 ml-11">
        {suggestion.action && onAccept && (
          <button
            onClick={onAccept}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm transition-colors"
          >
            Update exercise
          </button>
        )}
        {onNotYet && (
          <button
            onClick={onNotYet}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm transition-colors"
          >
            Not yet
          </button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="px-4 py-2 text-gray-500 hover:text-gray-700 font-medium text-sm transition-colors"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  )
}
