'use client'

import type { Rating } from '@/lib/types'

/**
 * Directional rating chevrons: step back (-1), steady (0), step forward (1).
 *
 * Uses shape + color to encode meaning (accessible to colorblind users):
 * - Down arrow = step back (amber)
 * - Horizontal line = steady (neutral)
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
      activeClass:
        'bg-rating-back-bg text-rating-back-icon border-rating-back-border',
    },
    {
      rating: 0,
      label: 'Steady',
      icon: '—',
      activeClass:
        'bg-rating-steady-bg text-rating-steady-icon border-rating-steady-border',
    },
    {
      rating: 1,
      label: 'Step forward',
      icon: '↑',
      activeClass:
        'bg-rating-forward-bg text-rating-forward-icon border-rating-forward-border',
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
            className={`w-7 h-7 flex items-center justify-center rounded-md border text-xs font-medium transition-colors ${
              isActive
                ? btn.activeClass
                : 'border-border-default text-text-tertiary hover:border-border-input hover:text-text-secondary'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {btn.icon}
          </button>
        )
      })}
    </div>
  )
}
