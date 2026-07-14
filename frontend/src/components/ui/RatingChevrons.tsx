'use client'

import type { Rating } from '@/lib/types'

/**
 * Directional rating chevrons: step back (-1), steady (0), step forward (1).
 *
 * Uses shape + color to encode meaning (accessible to colorblind users):
 * - Down arrow = step back (amber)
 * - Horizontal line = steady (gray)
 * - Up arrow = step forward (teal)
 */
export default function RatingChevrons({
  value,
  onChange,
  disabled = false,
}: {
  value: Rating | null
  onChange: (rating: Rating) => void
  disabled?: boolean
}) {
  const buttons: { rating: Rating; label: string; icon: string; activeClass: string }[] = [
    {
      rating: -1,
      label: 'Step back',
      icon: '↓',
      activeClass: 'bg-amber-100 text-amber-700 border-amber-300',
    },
    {
      rating: 0,
      label: 'Steady',
      icon: '—',
      activeClass: 'bg-gray-200 text-gray-700 border-gray-400',
    },
    {
      rating: 1,
      label: 'Step forward',
      icon: '↑',
      activeClass: 'bg-teal-100 text-teal-700 border-teal-300',
    },
  ]

  return (
    <div className="flex gap-1">
      {buttons.map((btn) => {
        const isActive = value === btn.rating
        return (
          <button
            key={btn.rating}
            type="button"
            disabled={disabled}
            onClick={() => onChange(btn.rating)}
            aria-label={btn.label}
            aria-pressed={isActive}
            className={`w-8 h-8 flex items-center justify-center rounded-full border text-sm font-medium transition-colors ${
              isActive
                ? btn.activeClass
                : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {btn.icon}
          </button>
        )
      })}
    </div>
  )
}
