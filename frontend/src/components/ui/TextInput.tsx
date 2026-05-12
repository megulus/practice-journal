import { forwardRef, type InputHTMLAttributes } from 'react'
import { cx } from '@/lib/cx'

export type TextInputVariant = 'standard' | 'recessed'

export interface TextInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  variant?: TextInputVariant
}

const BASE =
  'w-full rounded-md border border-border-input text-text-primary ' +
  'placeholder:italic placeholder:text-text-tertiary ' +
  'focus:outline-none focus:border-border-input-focus ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ' +
  'disabled:opacity-50 disabled:cursor-not-allowed transition-colors'

const VARIANTS: Record<TextInputVariant, string> = {
  standard: 'bg-input-bg',
  recessed: 'bg-input-bg-recessed',
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  function TextInput(
    { variant = 'standard', className, type = 'text', ...props },
    ref,
  ) {
    return (
      <input
        ref={ref}
        type={type}
        className={cx(BASE, VARIANTS[variant], className)}
        style={{ fontSize: 13, lineHeight: 1.5, padding: '10px 12px' }}
        {...props}
      />
    )
  },
)
