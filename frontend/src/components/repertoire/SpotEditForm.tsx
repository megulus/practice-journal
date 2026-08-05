'use client'

import { useState } from 'react'
import { Button, TextInput } from '@/components/ui'
import { LocationInput } from './LocationInput'

export interface SpotFormValues {
  name: string
  location: string
}

/**
 * Create/edit form for a spot: required name plus the optional
 * {@link LocationInput}. Used both for "+ Add spot" and for editing an
 * existing spot in the repertoire library.
 *
 * The submit button label is the caller's, because "Add" and "Save" are the
 * same form doing two different jobs.
 */
export function SpotEditForm({
  initialName = '',
  initialLocation = '',
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initialName?: string
  initialLocation?: string
  submitLabel: string
  onSubmit: (values: SpotFormValues) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(initialName)
  const [location, setLocation] = useState(initialLocation)
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || busy) return
    setBusy(true)
    try {
      await onSubmit({ name: trimmed, location: location.trim() })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-md rounded-lg bg-card-bg-inset p-md"
    >
      <TextInput
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Spot name"
        aria-label="Spot name"
        autoFocus
      />
      <LocationInput value={location} onChange={setLocation} />
      <div className="flex gap-sm">
        <Button type="submit" size="sm" disabled={busy || !name.trim()}>
          {submitLabel}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
