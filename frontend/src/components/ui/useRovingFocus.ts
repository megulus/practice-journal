'use client'

import { useRef, type KeyboardEvent } from 'react'

export interface UseRovingFocusOptions<T> {
  /** Option values in render order. Compared by identity — pass primitives. */
  values: T[]
  /** The currently selected value. */
  value: T
  /** Selection follows focus, so arrow keys call this too. */
  onChange: (value: T) => void
}

export interface RovingFocus<E extends HTMLElement> {
  /** Index of the checked option, or -1 when `value` matches nothing. */
  checkedIndex: number
  /** Index that carries `tabIndex=0`; everything else gets -1. */
  tabStopIndex: number
  /** Attach to the `role="radiogroup"` container. */
  handleKeyDown: (event: KeyboardEvent<HTMLElement>) => void
  /** `ref={itemRef(index)}` on each option, so the handler can focus them. */
  itemRef: (index: number) => (el: E | null) => void
}

/**
 * Roving-focus keyboard behavior for the WAI-ARIA radiogroup pattern.
 *
 * `role="radio"` on a `<button>` buys the semantics but none of the behavior:
 * without this the group is one tab stop *per option* and the arrow keys do
 * nothing. Here the group is a single tab stop (on the checked option, or the
 * first one when nothing is checked — never nowhere, or the group becomes
 * unreachable), and Left/Right/Up/Down move between options with wrap and with
 * selection following focus.
 *
 * Extracted from {@link PillRadioGroup} so groups that can't be pills — the
 * quick-start wizard's two-line time-budget cards — don't diverge from it. Use
 * `PillRadioGroup` when the options *are* pills; reach for this hook only when
 * the visual doesn't fit. The native {@link Radio} primitive gets all of this
 * from the browser and stays the first choice when its look is acceptable.
 */
export function useRovingFocus<T, E extends HTMLElement = HTMLElement>({
  values,
  value,
  onChange,
}: UseRovingFocusOptions<T>): RovingFocus<E> {
  const items = useRef<(E | null)[]>([])

  const checkedIndex = values.findIndex((candidate) => candidate === value)
  const tabStopIndex = checkedIndex === -1 ? 0 : checkedIndex

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0
    // Only swallow the keys we act on — preventDefault before this check would
    // eat Tab, Enter and everything else.
    if (step === 0 || values.length === 0) return
    event.preventDefault()

    // Read the origin off the focused option rather than off `value`: the two
    // agree while selection follows focus, but not if a caller ignores a change.
    const focusedIndex = items.current.indexOf(event.target as E)
    const from = focusedIndex === -1 ? tabStopIndex : focusedIndex
    const next = (from + step + values.length) % values.length

    items.current[next]?.focus()
    onChange(values[next])
  }

  return {
    checkedIndex,
    tabStopIndex,
    handleKeyDown,
    itemRef: (index) => (el) => {
      items.current[index] = el
    },
  }
}
