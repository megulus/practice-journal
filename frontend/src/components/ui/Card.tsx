import {
  forwardRef,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from 'react'
import { cx } from '@/lib/cx'

type CardVariant = 'default' | 'suggestion' | 'coaching' | 'hint'

type CardCommonProps = HTMLAttributes<HTMLDivElement>

type StandardCardProps = CardCommonProps & {
  variant?: 'default' | 'coaching' | 'hint'
}

type SuggestionCardProps = CardCommonProps & {
  variant: 'suggestion'
  // 18×18 amber chip content rendered to the left of children.
  icon: ReactNode
}

export type CardProps = StandardCardProps | SuggestionCardProps

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
  props,
  ref,
) {
  if (props.variant === 'suggestion') {
    const { icon, className, style, children, ...rest } = props
    return (
      <div
        ref={ref}
        className={cx(
          VARIANT_CLASSES.suggestion,
          'flex items-start gap-md',
          className,
        )}
        style={{ ...VARIANT_STYLES.suggestion, ...style }}
        {...rest}
      >
        <span
          aria-hidden="true"
          className="inline-flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-sm bg-amber-icon-bg text-white"
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    )
  }

  const { variant = 'default', className, style, children, ...rest } = props
  return (
    <div
      ref={ref}
      className={cx(VARIANT_CLASSES[variant], className)}
      style={{ ...VARIANT_STYLES[variant], ...style }}
      {...rest}
    >
      {children}
    </div>
  )
})
