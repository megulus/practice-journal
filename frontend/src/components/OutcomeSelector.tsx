'use client'

import type { PracticeOutcome } from '@/lib/types'

interface OutcomeSelectorProps {
  value?: PracticeOutcome
  onChange: (outcome: PracticeOutcome | undefined) => void
  size?: 'sm' | 'md'
}

const outcomes: { value: PracticeOutcome; label: string; emoji: string; color: string }[] = [
  {
    value: 'struggled',
    label: 'Struggled',
    emoji: '😓',
    color: 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200',
  },
  {
    value: 'okay',
    label: 'Okay',
    emoji: '😐',
    color: 'bg-yellow-100 text-yellow-700 border-yellow-300 hover:bg-yellow-200',
  },
  {
    value: 'nailed_it',
    label: 'Nailed it!',
    emoji: '🎯',
    color: 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200',
  },
]

export default function OutcomeSelector({ value, onChange, size = 'md' }: OutcomeSelectorProps) {
  const sizeClasses = size === 'sm' ? 'px-2 py-1 text-sm' : 'px-3 py-2'

  return (
    <div className="flex gap-2">
      {outcomes.map((outcome) => {
        const isSelected = value === outcome.value
        return (
          <button
            key={outcome.value}
            type="button"
            onClick={() => onChange(isSelected ? undefined : outcome.value)}
            className={`
              ${sizeClasses}
              rounded-lg border-2 font-medium transition-all
              ${isSelected
                ? `${outcome.color} ring-2 ring-offset-1 ring-current`
                : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
              }
            `}
          >
            <span className="mr-1">{outcome.emoji}</span>
            {outcome.label}
          </button>
        )
      })}
    </div>
  )
}
