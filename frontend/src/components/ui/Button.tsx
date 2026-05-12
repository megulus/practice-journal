import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cx } from '@/lib/cx'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
}

const BASE =
  'inline-flex items-center justify-center font-semibold rounded-lg transition-colors ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ' +
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none'

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-text-on-primary-action hover:bg-primary-hover border border-primary',
  secondary:
    'bg-transparent text-text-primary border border-border-input hover:bg-card-bg-inset',
  ghost:
    'bg-transparent text-text-link border border-transparent hover:underline',
  danger:
    'bg-danger-text text-text-on-primary-action border border-danger-text hover:opacity-90',
}

const SIZES: Record<ButtonSize, string> = {
  md: 'text-[15px] leading-[1.35] px-lg py-[14px]',
  sm: 'text-[13px] leading-[1.35] px-md py-[8px]',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = 'primary',
      size = 'md',
      fullWidth = false,
      className,
      type = 'button',
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cx(
          BASE,
          VARIANTS[variant],
          SIZES[size],
          fullWidth && 'w-full',
          className,
        )}
        {...props}
      />
    )
  },
)
