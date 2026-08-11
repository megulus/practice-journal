'use client'

import { useEffect, useRef, useState } from 'react'
import { TextInput, VoiceInput } from '@/components/ui'

/**
 * Smart-insert chips for the location field, in their default order
 * (repertoire design doc, "Creating a brand-new spot").
 */
const DEFAULT_CHIPS = ['mm.', 'page', 'letter', 'to', '–']

const STORAGE_KEY = 'kantelo-location-chips'
/** How many recently-used chips we remember; the rest keep their default order. */
const RECENT_LIMIT = DEFAULT_CHIPS.length

function readRecent(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (c): c is string => typeof c === 'string' && DEFAULT_CHIPS.includes(c),
    )
  } catch {
    // Corrupt or unavailable storage just means no adaptive ordering.
    return []
  }
}

function writeRecent(recent: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(recent))
  } catch {
    // Private-mode / quota failures are not worth surfacing.
  }
}

/** Most-recently-used chips first, then the untouched ones in default order. */
export function orderChips(recent: string[]): string[] {
  const used = recent.filter((c) => DEFAULT_CHIPS.includes(c))
  return [...used, ...DEFAULT_CHIPS.filter((c) => !used.includes(c))]
}

export interface LocationInputProps {
  value: string
  onChange: (next: string) => void
  /** Accessible name for the field. */
  label?: string
  placeholder?: string
}

/**
 * Optional "where in the piece" field for a spot, with a row of smart-insert
 * chips beneath it. Tapping a chip inserts its text at the caret (adding a
 * separating space when needed) and keeps focus in the field, so a location
 * like "mm. 34 to 41" is a few taps rather than a full typing exercise.
 *
 * Chip order adapts to use: the chips you reach for most float to the front,
 * remembered in localStorage. That's deliberately device-local — it's a typing
 * shortcut, not a preference worth a server round trip.
 */
export function LocationInput({
  value,
  onChange,
  label = 'Location',
  placeholder = 'Where in the piece? (optional)',
}: LocationInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const pendingCaret = useRef<number | null>(null)
  // Server render and first client render must match, so the default order is
  // rendered first and the stored order is applied on mount.
  const [chips, setChips] = useState<string[]>(DEFAULT_CHIPS)

  useEffect(() => {
    setChips(orderChips(readRecent()))
  }, [])

  // Restore the caret after a chip insertion re-renders the input.
  useEffect(() => {
    const caret = pendingCaret.current
    if (caret === null) return
    pendingCaret.current = null
    const el = inputRef.current
    if (!el) return
    el.focus()
    el.setSelectionRange(caret, caret)
  })

  const insertChip = (chip: string) => {
    const el = inputRef.current
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    const before = value.slice(0, start)
    const after = value.slice(end)
    // Pad with spaces so tapping "mm." and typing "34" reads as "mm. 34",
    // but never double up on whitespace that's already there.
    const lead = before && !/\s$/.test(before) ? ' ' : ''
    const trail = /^\s/.test(after) ? '' : ' '
    const insertion = `${lead}${chip}${trail}`

    onChange(before + insertion + after)
    pendingCaret.current = before.length + insertion.length

    const recent = [chip, ...readRecent().filter((c) => c !== chip)].slice(
      0,
      RECENT_LIMIT,
    )
    writeRecent(recent)
    setChips(orderChips(recent))
  }

  return (
    <div className="space-y-sm">
      <div className="relative">
        <TextInput
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={label}
          className="pr-11"
        />
        <VoiceInput
          aria-label={`${label} by voice`}
          className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
          onTranscript={(text) => {
            const next = value && !/\s$/.test(value) ? `${value} ${text}` : value + text
            onChange(next)
            pendingCaret.current = next.length
          }}
        />
      </div>
      <div className="flex flex-wrap gap-sm">
        {chips.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => insertChip(chip)}
            aria-label={`Insert “${chip}”`}
            className="rounded-md border border-border-default px-2 py-1 text-xs text-text-secondary transition-colors hover:border-border-input hover:text-text-primary"
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  )
}
