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
        className="w-[22px] h-[22px] flex items-center justify-center rounded-md border border-border-input text-text-secondary text-sm hover:bg-card-bg-inset disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Decrease duration"
      >
        −
      </button>
      <span className="text-[13px] font-medium text-text-primary min-w-[44px] text-center tabular-nums">
        {value} min
      </span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(value + 1)}
        className="w-[22px] h-[22px] flex items-center justify-center rounded-md border border-border-input text-text-secondary text-sm hover:bg-card-bg-inset disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Increase duration"
      >
        +
      </button>
    </div>
  )
}
