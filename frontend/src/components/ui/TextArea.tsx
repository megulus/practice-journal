import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { cx } from '@/lib/cx'

export type TextAreaVariant = 'standard' | 'recessed'

export interface TextAreaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  variant?: TextAreaVariant
}

const BASE =
  'w-full rounded-md border border-border-input text-text-primary ' +
  'placeholder:italic placeholder:text-text-tertiary ' +
  'focus:outline-none focus:border-border-input-focus ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ' +
  'disabled:opacity-50 disabled:cursor-not-allowed transition-colors resize-y'

const VARIANTS: Record<TextAreaVariant, string> = {
  standard: 'bg-input-bg',
  recessed: 'bg-input-bg-recessed',
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  function TextArea({ variant = 'standard', className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cx(BASE, VARIANTS[variant], className)}
        style={{ fontSize: 13, lineHeight: 1.5, padding: '10px 12px' }}
        {...props}
      />
    )
  },
)
