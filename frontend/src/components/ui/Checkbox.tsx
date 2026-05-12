'use client'

import {
  forwardRef,
  useState,
  type InputHTMLAttributes,
  type ChangeEvent,
} from 'react'
import { Check } from 'lucide-react'
import { cx } from '@/lib/cx'

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: string
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox(
    {
      label,
      checked,
      defaultChecked,
      onChange,
      disabled,
      className,
      ...rest
    },
    ref,
  ) {
    const isControlled = checked !== undefined
    const [internal, setInternal] = useState(defaultChecked ?? false)
    const isChecked = isControlled ? checked : internal

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
      if (!isControlled) setInternal(e.target.checked)
      onChange?.(e)
    }

    return (
      <label
        className={cx(
          'inline-flex items-center gap-md',
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
          className,
        )}
      >
        <span className="relative inline-flex items-center justify-center w-[18px] h-[18px]">
          <input
            ref={ref}
            type="checkbox"
            checked={isChecked}
            onChange={handleChange}
            disabled={disabled}
            className="peer sr-only"
            {...rest}
          />
          <span
            aria-hidden
            className={cx(
              'absolute inset-0 rounded-[4px] transition-colors',
              isChecked
                ? 'bg-primary'
                : 'border-[1.5px] border-border-input bg-transparent',
              'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary',
            )}
          />
          {isChecked && (
            <Check
              className="relative text-text-on-primary-action pointer-events-none"
              size={12}
              strokeWidth={2}
              aria-hidden
            />
          )}
        </span>
        {label && (
          <span
            className="text-text-primary"
            style={{ fontSize: 13, lineHeight: 1.5 }}
          >
            {label}
          </span>
        )}
      </label>
    )
  },
)
