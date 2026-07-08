import { cx } from '@/lib/cx'

export interface RotationDotsProps {
  /** Number of sessions in the rotation. */
  total: number
  /** 1-based position of the current session in the rotation. */
  current: number
  className?: string
}

/**
 * Filled-dot rotation indicator for the "Today's practice" header (spec §5.1) —
 * one dot per session in the rotation, the current position filled. Distinct
 * from {@link RotationBar} (a segmented progress bar used mid-session).
 */
export function RotationDots({ total, current, className }: RotationDotsProps) {
  if (total <= 0) return null
  return (
    <span
      role="img"
      aria-label={`Session ${current} of ${total}`}
      className={cx('inline-flex items-center gap-1', className)}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={cx(
            'h-1.5 w-1.5 rounded-round',
            i + 1 === current ? 'bg-primary' : 'bg-border-default',
          )}
        />
      ))}
    </span>
  )
}
