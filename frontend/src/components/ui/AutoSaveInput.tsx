'use client'

import {
  forwardRef,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { useAutoSaveField } from './useAutoSaveField'

interface AutoSaveOwnProps {
  /** Source-of-truth value from props/server. */
  value: string
  /** Commit a changed value on blur. */
  onCommit: (next: string) => void
  /** Trim before comparing/committing. Default `true`. */
  trim?: boolean
  /** Roll back to `value` when emptied instead of committing `''`. Default `true`. */
  rollbackWhenEmpty?: boolean
}

export type AutoSaveInputProps = AutoSaveOwnProps &
  Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'value' | 'onChange' | 'onBlur' | 'onFocus'
  >

export type AutoSaveTextareaProps = AutoSaveOwnProps &
  Omit<
    TextareaHTMLAttributes<HTMLTextAreaElement>,
    'value' | 'onChange' | 'onBlur' | 'onFocus'
  >

/**
 * Auto-saving text input. Holds the in-flight edit, commits on blur, and
 * re-syncs to `value` when not focused (see {@link useAutoSaveField}). Style-
 * agnostic — pass `className` for the look you want.
 */
export const AutoSaveInput = forwardRef<HTMLInputElement, AutoSaveInputProps>(
  function AutoSaveInput(
    { value, onCommit, trim, rollbackWhenEmpty, type = 'text', ...rest },
    ref,
  ) {
    const field = useAutoSaveField<string>({
      value,
      onCommit,
      trim,
      rollbackWhenEmpty,
    })
    return <input ref={ref} type={type} {...rest} {...field} />
  },
)

/** Textarea counterpart to {@link AutoSaveInput}. */
export const AutoSaveTextarea = forwardRef<
  HTMLTextAreaElement,
  AutoSaveTextareaProps
>(function AutoSaveTextarea(
  { value, onCommit, trim, rollbackWhenEmpty, ...rest },
  ref,
) {
  const field = useAutoSaveField<string>({
    value,
    onCommit,
    trim,
    rollbackWhenEmpty,
  })
  return <textarea ref={ref} {...rest} {...field} />
})
