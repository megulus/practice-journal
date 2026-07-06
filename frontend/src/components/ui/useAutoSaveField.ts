'use client'

import { useEffect, useRef, useState, type ChangeEvent } from 'react'

export interface UseAutoSaveFieldOptions<T> {
  /** Source-of-truth value from props/server. */
  value: T
  /** Commit a changed value. Called on blur, only when the parsed value differs. */
  onCommit: (next: T) => void
  /** Render the value as the input's string. Defaults to `String(value)` (`''` for nullish). */
  format?: (value: T) => string
  /** Parse the (optionally trimmed) input string back to `T`. Required for non-string `T`. */
  parse?: (input: string) => T
  /** Trim the input before parsing and comparing. Default `true`. */
  trim?: boolean
  /** When the (trimmed) input is empty, roll back to `value` instead of committing. Default `true`. */
  rollbackWhenEmpty?: boolean
}

export interface AutoSaveFieldBinding {
  value: string
  onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  onFocus: () => void
  onBlur: () => void
}

function defaultFormat<T>(value: T): string {
  return value == null ? '' : String(value)
}

/**
 * State logic for an auto-saving text field: holds the in-flight edit locally,
 * commits on blur (with empty-input rollback), and — crucially — re-syncs to the
 * latest `value` prop whenever the user is *not* actively editing. That last part
 * is what removes the stale-`useState(initial)` hazard the ad-hoc fields had.
 *
 * Returns a binding to spread onto an `<input>`/`<textarea>`. `T` should be a
 * primitive (string/number); supply `format`/`parse` for non-string values.
 */
export function useAutoSaveField<T>({
  value,
  onCommit,
  format = defaultFormat,
  parse = (input) => input as unknown as T,
  trim = true,
  rollbackWhenEmpty = true,
}: UseAutoSaveFieldOptions<T>): AutoSaveFieldBinding {
  const [draft, setDraft] = useState(() => format(value))
  const editingRef = useRef(false)

  // Latest helpers, read inside the re-sync effect without making it a dependency.
  const formatRef = useRef(format)
  formatRef.current = format

  // Re-sync to the source value when it changes and the user isn't editing.
  // While focused, the in-flight draft is preserved so a background refresh
  // (multi-device sync, optimistic revert) can't clobber what's being typed.
  // Deps are [value] only: `format`/`parse` are assumed behaviorally stable —
  // a changed formatter alone won't re-render the draft. All current consumers
  // pass constant helpers; revisit if one needs a value-dependent format.
  useEffect(() => {
    if (!editingRef.current) setDraft(formatRef.current(value))
  }, [value])

  return {
    value: draft,
    onChange: (e) => setDraft(e.target.value),
    onFocus: () => {
      editingRef.current = true
    },
    onBlur: () => {
      editingRef.current = false
      const raw = trim ? draft.trim() : draft
      if (rollbackWhenEmpty && raw === '') {
        setDraft(format(value))
        return
      }
      const next = parse(raw)
      if (next !== value) onCommit(next)
      // Normalize the display to the committed value (e.g. "07" -> "7", trimmed).
      setDraft(format(next))
    },
  }
}
