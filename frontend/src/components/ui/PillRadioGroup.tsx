'use client'

import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cx } from '@/lib/cx'
import { Pill } from './Pill'

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
  className?: string
}

/**
 * PillRadioGroup — a set of mutually-exclusive {@link Pill} options wired to
 * the WAI-ARIA radiogroup pattern.
 *
 * Pills are the right visual for short exclusive values (durations, day names),
 * but `role="radio"` on a `<button>` only buys the semantics — the keyboard
 * behavior a radiogroup promises has to be built. So: the group is a single tab
 * stop (the checked option carries `tabIndex=0`, everything else `-1`), and the
 * arrow keys move between options with selection following focus. The native
 * {@link Radio} primitive gets all of this from the browser; reach for that
 * instead whenever the list-with-descriptions look is acceptable.
 *
 * Values are compared by identity, so pass primitives (or stable references).
 */
export function PillRadioGroup<T>({
  label,
  options,
  value,
  onChange,
  className,
}: PillRadioGroupProps<T>) {
  const pills = useRef<(HTMLButtonElement | null)[]>([])
  const checkedIndex = options.findIndex((option) => option.value === value)
  // The pattern puts the tab stop on the checked option, or on the first one
  // when nothing is checked — never nowhere, or the group becomes unreachable.
  const tabStopIndex = checkedIndex === -1 ? 0 : checkedIndex

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0
    if (step === 0 || options.length === 0) return
    event.preventDefault()

    // Read the origin off the focused pill rather than off `value`: the two
    // agree while selection follows focus, but not if a caller ignores a change.
    const focusedIndex = pills.current.indexOf(event.target as HTMLButtonElement)
    const from = focusedIndex === -1 ? tabStopIndex : focusedIndex
    const next = (from + step + options.length) % options.length

    pills.current[next]?.focus()
    onChange(options[next].value)
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={handleKeyDown}
      className={cx('flex flex-wrap gap-sm', className)}
    >
      {options.map((option, index) => {
        const checked = index === checkedIndex
        return (
          <Pill
            key={String(option.value)}
            ref={(el) => {
              pills.current[index] = el
            }}
            role="radio"
            aria-checked={checked}
            tabIndex={index === tabStopIndex ? 0 : -1}
            active={checked}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Pill>
        )
      })}
    </div>
  )
}
