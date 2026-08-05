'use client'

import { useRef } from 'react'
import { Search } from 'lucide-react'
import { VoiceInput } from '@/components/ui'

export interface SearchCreateInputProps {
  value: string
  onChange: (next: string) => void
  placeholder: string
  /** Accessible name for the field. */
  label: string
  autoFocus?: boolean
}

/**
 * The search-doubles-as-create input: a search field that filters what already
 * exists and, when nothing matches what was typed, hands the same text to a
 * create affordance rendered by the caller.
 *
 * One component for both places the pattern appears (repertoire doc, "Why the
 * same search pattern in two places"): searching pieces in the block library's
 * "Your repertoire" tab, and searching a piece's spots in the spot management
 * drawer. Only the subject and what "Create" produces differ, so the input
 * itself is shared and the results/create affordance stay with the caller.
 */
export function SearchCreateInput({
  value,
  onChange,
  placeholder,
  label,
  autoFocus,
}: SearchCreateInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="relative">
      <Search
        size={16}
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
      />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        autoFocus={autoFocus}
        className="w-full rounded-md border border-border-input bg-input-bg py-2 pl-9 pr-11 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-input-focus focus:outline-none"
      />
      <VoiceInput
        aria-label={`${label} by voice`}
        className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
        onTranscript={(text) => {
          onChange(value ? `${value} ${text}` : text)
          inputRef.current?.focus()
        }}
      />
    </div>
  )
}
