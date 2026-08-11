'use client'

import { type ReactNode } from 'react'
import { Pill } from './Pill'
import { useRovingFocus } from './useRovingFocus'

export interface PillRadioOption<T> {
  value: T
  /** Pill contents — text, or an icon plus text. */
  label: ReactNode
}

export interface PillRadioGroupProps<T> {
  /** Accessible name for the group (rendered as the container's aria-label). */
  label: string
  options: PillRadioOption<T>[]
  value: T
  onChange: (value: T) => void
  /**
   * Container layout classes. Defaults to a wrapping row (`flex flex-wrap
   * gap-sm`); pass a full *replacement* when a call site needs different
   * spacing or overflow behavior. `cx` is a plain joiner, not tailwind-merge,
   * so an appended `gap-*` would collide with the default rather than beat it.
   */
  className?: string
  /** Extra classes for each pill (e.g. `whitespace-nowrap`). */
  pillClassName?: string
}

/**
 * PillRadioGroup — a set of mutually-exclusive {@link Pill} options wired to
 * the WAI-ARIA radiogroup pattern.
 *
 * Pills are the right visual for short exclusive values (durations, day names),
 * but `role="radio"` on a `<button>` only buys the semantics — the keyboard
 * behavior a radiogroup promises has to be built. That part lives in
 * {@link useRovingFocus}: single tab stop, arrow keys with wrap, selection
 * following focus. The native {@link Radio} primitive gets all of this from the
 * browser; reach for that instead whenever the list-with-descriptions look is
 * acceptable.
 *
 * Values are compared by identity, so pass primitives (or stable references).
 */
export function PillRadioGroup<T>({
  label,
  options,
  value,
  onChange,
  className,
  pillClassName,
}: PillRadioGroupProps<T>) {
  const { checkedIndex, tabStopIndex, handleKeyDown, itemRef } = useRovingFocus<
    T,
    HTMLButtonElement
  >({
    values: options.map((option) => option.value),
    value,
    onChange,
  })

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={handleKeyDown}
      className={className ?? 'flex flex-wrap gap-sm'}
    >
      {options.map((option, index) => {
        const checked = index === checkedIndex
        return (
          <Pill
            key={String(option.value)}
            ref={itemRef(index)}
            role="radio"
            aria-checked={checked}
            tabIndex={index === tabStopIndex ? 0 : -1}
            active={checked}
            className={pillClassName}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Pill>
        )
      })}
    </div>
  )
}
