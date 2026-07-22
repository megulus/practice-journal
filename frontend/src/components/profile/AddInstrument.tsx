'use client'

import { useState } from 'react'
import { useApi } from '@/lib/useApi'
import { Button, Pill, TextInput } from '@/components/ui'
import type { PracticeFrequency } from '@/lib/types'
import { PRACTICE_FREQUENCIES } from './frequencies'

const DEFAULT_FREQUENCY: PracticeFrequency = 'few_times_a_week'

/**
 * Inline-expand "+ Add instrument" affordance (name + cadence), mirroring the
 * template editor's "+ Add section" pattern (spec §5.8).
 */
export function AddInstrument({ onAdded }: { onAdded: () => void }) {
  const api = useApi()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [frequency, setFrequency] = useState<PracticeFrequency>(DEFAULT_FREQUENCY)
  const [busy, setBusy] = useState(false)

  const reset = () => {
    setName('')
    setFrequency(DEFAULT_FREQUENCY)
    setOpen(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || busy) return
    setBusy(true)
    try {
      await api.createInstrument({ name: trimmed, practice_frequency: frequency })
      reset()
      onAdded()
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-dashed border-border-default py-3 text-sm text-text-secondary transition-colors hover:border-border-input hover:text-text-primary"
      >
        + Add instrument
      </button>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-xl border border-border-default bg-card-bg p-4"
    >
      <TextInput
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Instrument name"
        aria-label="New instrument name"
        autoFocus
      />
      <div className="flex flex-wrap gap-2">
        {PRACTICE_FREQUENCIES.map(({ value, label }) => (
          <Pill
            key={value}
            active={frequency === value}
            aria-pressed={frequency === value}
            onClick={() => setFrequency(value)}
          >
            {label}
          </Pill>
        ))}
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={busy || !name.trim()}>
          Add
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={reset}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
