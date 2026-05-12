import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cx } from '@/lib/cx'
import type { SectionColor } from '@/lib/section-colors'

/**
 * Pill — two variants with distinct shape and semantics.
 *
 * - `instrument`: interactive toggle (instrument switcher, theme picker,
 *   generic on/off pill). Renders as <button>.
 * - `sectionType`: decorative label colored by section type (warm-up,
 *   scales, etc.). Renders as <span>.
 *
 * The variants use different sizing per design tokens §6.
 */

type InstrumentPillProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'instrument'
  active?: boolean
  children: ReactNode
}

interface SectionTypePillProps {
  variant: 'sectionType'
  color: SectionColor
  children: ReactNode
  className?: string
}

export type PillProps = InstrumentPillProps | SectionTypePillProps

const INSTRUMENT_BASE =
  'inline-flex items-center gap-sm rounded-md text-xs font-medium transition-colors ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ' +
  'disabled:opacity-50 disabled:cursor-not-allowed'

const SECTION_BASE = 'inline-flex items-center rounded-sm font-medium'

export const Pill = forwardRef<HTMLButtonElement, PillProps>(function Pill(
  props,
  ref,
) {
  if (props.variant === 'sectionType') {
    const { color, children, className } = props
    return (
      <span
        className={cx(SECTION_BASE, className)}
        style={{
          backgroundColor: color.pillBg,
          color: color.pillText,
          padding: '3px 9px',
          fontSize: 11,
          lineHeight: 1.4,
        }}
      >
        {children}
      </span>
    )
  }

  const { active = false, className, type = 'button', children, ...rest } = props
  return (
    <button
      ref={ref}
      type={type}
      aria-pressed={active}
      className={cx(
        INSTRUMENT_BASE,
        active
          ? 'bg-pill-active-bg text-pill-active-text border border-pill-active-bg'
          : 'bg-transparent text-pill-inactive-text border border-pill-inactive-border hover:text-text-primary',
        className,
      )}
      style={{ padding: '5px 14px' }}
      {...rest}
    >
      {children}
    </button>
  )
})
