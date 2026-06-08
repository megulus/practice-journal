import {
  forwardRef,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from 'react'
import { cx } from '@/lib/cx'

export type CardVariant = 'default' | 'suggestion' | 'coaching' | 'hint'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
  // Suggestion variant only: content for the 18×18 amber chip on the left.
  icon?: ReactNode
}

const VARIANT_CLASSES: Record<CardVariant, string> = {
  default: 'bg-card-bg border border-border-default rounded-xl text-text-primary',
  suggestion: 'bg-amber-bg border border-amber-border rounded-lg',
  coaching: 'bg-coaching-bg rounded-lg text-coaching-text',
  hint: 'bg-input-bg-recessed border-l-2 border-border-input rounded-md text-text-secondary',
}

const VARIANT_STYLES: Record<CardVariant, CSSProperties> = {
  default: { padding: 18 },
  suggestion: { padding: '12px 14px' },
  coaching: { padding: 14, fontSize: 13, lineHeight: 1.55 },
  hint: { padding: '8px 10px', fontSize: 11, lineHeight: 1.5 },
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = 'default', icon, className, style, children, ...rest },
  ref,
) {
  const classes = cx(VARIANT_CLASSES[variant], className)
  const mergedStyle = { ...VARIANT_STYLES[variant], ...style }

  if (variant === 'suggestion' && icon !== undefined) {
    return (
      <div
        ref={ref}
        className={cx(classes, 'flex items-start gap-md')}
        style={mergedStyle}
        {...rest}
      >
        <span
          aria-hidden="true"
          className="inline-flex flex-shrink-0 items-center justify-center rounded-sm text-white"
          style={{
            width: 18,
            height: 18,
            backgroundColor: 'var(--amber-icon-bg)',
          }}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    )
  }

  return (
    <div ref={ref} className={classes} style={mergedStyle} {...rest}>
      {children}
    </div>
  )
})
