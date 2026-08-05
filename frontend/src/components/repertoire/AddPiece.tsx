'use client'

import { useState } from 'react'
import { Button, TextInput } from '@/components/ui'

/**
 * Inline-expand "+ Add piece" affordance for the repertoire library, matching
 * the dashed "+ Add instrument" / "+ Add section" pattern used elsewhere.
 */
export function AddPiece({
  onAdd,
}: {
  /** Resolves `true` when the piece was created; `false` keeps the form open. */
  onAdd: (name: string, composer: string) => Promise<boolean>
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [composer, setComposer] = useState('')
  const [busy, setBusy] = useState(false)

  const reset = () => {
    setName('')
    setComposer('')
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-dashed border-border-default py-3 text-sm text-text-secondary transition-colors hover:border-border-input hover:text-text-primary"
      >
        + Add piece
      </button>
    )
  }

  return (
    <form
      className="space-y-md rounded-xl border border-border-default bg-card-bg p-4"
      onSubmit={async (e) => {
        e.preventDefault()
        const trimmed = name.trim()
        if (!trimmed || busy) return
        setBusy(true)
        try {
          if (await onAdd(trimmed, composer.trim())) reset()
        } finally {
          setBusy(false)
        }
      }}
    >
      <TextInput
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Piece name"
        aria-label="New piece name"
        autoFocus
      />
      <TextInput
        value={composer}
        onChange={(e) => setComposer(e.target.value)}
        placeholder="Composer or source (optional)"
        aria-label="Composer or source"
      />
      <div className="flex gap-sm">
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
