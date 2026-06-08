import { forwardRef, type HTMLAttributes } from 'react'
import { cx } from '@/lib/cx'

export interface ProgressBarProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'role'> {
  // 0..1 — values outside the range are clamped; NaN is treated as 0.
  value: number
  // Required for accessibility (becomes aria-label on the progressbar).
  label: string
}

export const ProgressBar = forwardRef<HTMLDivElement, ProgressBarProps>(
  function ProgressBar(
    { value, label, className, style, ...rest },
    ref,
  ) {
    const safe = Number.isFinite(value) ? value : 0
    const clamped = Math.max(0, Math.min(1, safe))
    const pctNum = Math.round(clamped * 100)
    const pct = `${pctNum}%`
    return (
      <div
        ref={ref}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped * 100)}
        className={cx('w-full overflow-hidden bg-border-default', className)}
        style={{ height: 3, borderRadius: 2, ...style }}
        {...rest}
      >
        <div
          className="h-full bg-primary transition-[width]"
          style={{ width: pct, borderRadius: 2 }}
        />
      </div>
    )
  },
)
