import { forwardRef, type HTMLAttributes } from 'react'
import { cx } from '@/lib/cx'
import type { SectionColor } from '@/lib/section-colors'

export interface SectionPipProps
  extends Omit<HTMLAttributes<HTMLSpanElement>, 'color'> {
  color: SectionColor
  size?: number
}

export const SectionPip = forwardRef<HTMLSpanElement, SectionPipProps>(
  function SectionPip(
    { color, size = 8, className, style, ...rest },
    ref,
  ) {
    return (
      <span
        ref={ref}
        aria-hidden="true"
        className={cx('inline-block rounded-round', className)}
        style={{
          width: size,
          height: size,
          backgroundColor: color.pip,
          ...style,
        }}
        {...rest}
      />
    )
  },
)
