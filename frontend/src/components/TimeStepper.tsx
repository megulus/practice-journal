'use client'

/**
 * Compact +/- stepper for section duration. Pre-filled from the plan's
 * estimated duration. Users adjust in 1-minute increments.
 */
export default function TimeStepper({
  value,
  onChange,
  disabled = false,
}: {
  value: number
  onChange: (minutes: number) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        disabled={disabled || value <= 0}
        onClick={() => onChange(Math.max(0, value - 1))}
        className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-200 text-gray-500 text-sm hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Decrease duration"
      >
        −
      </button>
      <span className="text-sm text-gray-600 w-12 text-center tabular-nums">
        {value} min
      </span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(value + 1)}
        className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-200 text-gray-500 text-sm hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Increase duration"
      >
        +
      </button>
    </div>
  )
}
