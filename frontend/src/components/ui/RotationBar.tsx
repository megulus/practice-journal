import { forwardRef, type HTMLAttributes } from 'react'
import { cx } from '@/lib/cx'

export interface RotationBarProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'role'> {
  // Non-finite values are treated as 0 (rendering an empty bar).
  total: number
  // 1-indexed: segments [1..current] are filled, current+1..total are empty.
  // Pass 0 to render an entirely-empty bar. Non-finite values become 0.
  current: number
  // Required for accessibility (becomes aria-label on the progressbar).
  label: string
}

export const RotationBar = forwardRef<HTMLDivElement, RotationBarProps>(
  function RotationBar(
    { total, current, label, className, style, ...rest },
    ref,
  ) {
    const safeTotal = Number.isFinite(total) ? total : 0
    const safeCurrent = Number.isFinite(current) ? current : 0
    const segments = Math.max(0, Math.floor(safeTotal))
    const filled = Math.max(0, Math.min(Math.floor(safeCurrent), segments))
    return (
      <div
        ref={ref}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={segments}
        aria-valuenow={filled}
        className={cx('flex w-full items-stretch', className)}
        style={{ gap: 3, ...style }}
        {...rest}
      >
        {Array.from({ length: segments }, (_, i) => {
          const isFilled = i < filled
          return (
            <span
              key={i}
              className={cx(
                'flex-1',
                isFilled ? 'bg-primary' : 'bg-border-default',
              )}
              style={{ height: 3, borderRadius: 2 }}
            />
          )
        })}
      </div>
    )
  },
)
