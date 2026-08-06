'use client'

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { cx } from '@/lib/cx'

export interface RadioProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  /** Primary label, rendered in body-medium next to the control. */
  label: ReactNode
  /** Optional second line explaining what the option does. */
  description?: ReactNode
}

/**
 * Radio — a single option in a native radio group.
 *
 * Always controlled by the caller (`checked` + `onChange`); grouping is by the
 * shared `name` prop, which is what gives us the browser's arrow-key roving
 * focus for free. Visually it mirrors {@link Checkbox}: an `sr-only` input
 * carries semantics and focus, a token-styled span carries the look.
 */
export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio(
  { label, description, checked, disabled, className, ...rest },
  ref,
) {
  return (
    <label
      className={cx(
        'flex items-start gap-md',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        className,
      )}
    >
      <span className="relative mt-[2px] inline-flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center">
        <input
          ref={ref}
          type="radio"
          checked={checked}
          disabled={disabled}
          className="peer sr-only"
          {...rest}
        />
        <span
          aria-hidden
          className={cx(
            'absolute inset-0 rounded-round border-[1.5px] transition-colors',
            checked ? 'border-primary' : 'border-border-input',
            'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary',
          )}
        />
        {checked && (
          <span
            aria-hidden
            className="relative h-[8px] w-[8px] rounded-round bg-primary"
          />
        )}
      </span>

      <span className="min-w-0">
        <span
          className="block text-text-primary"
          style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.5 }}
        >
          {label}
        </span>
        {description && (
          <span
            className="block text-text-secondary"
            style={{ fontSize: 13, lineHeight: 1.5 }}
          >
            {description}
          </span>
        )}
      </span>
    </label>
  )
})
