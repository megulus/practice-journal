'use client'

import { useState } from 'react'
import { useApi } from '@/lib/useApi'
import { Button, TextInput } from '@/components/ui'
import type { SectionType } from '@/lib/types'

// ---------------------------------------------------------------------------
// Add freeform section
// ---------------------------------------------------------------------------

export function AddSectionButton({
  logId,
  onAdd,
}: {
  logId: number
  onAdd: () => void
}) {
  const api = useApi()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<SectionType>('other')

  const sectionTypes: { value: SectionType; label: string }[] = [
    { value: 'warmup', label: 'Warm-up' },
    { value: 'scales', label: 'Scales' },
    { value: 'repertoire', label: 'Repertoire' },
    { value: 'sight_reading', label: 'Sight-reading' },
    { value: 'ear_training', label: 'Ear training' },
    { value: 'cooldown', label: 'Cool-down' },
    { value: 'other', label: 'Other' },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    await api.addFreeformSection(logId, {
      section_name: trimmed,
      section_type: type,
    })
    setName('')
    setType('other')
    setOpen(false)
    onAdd()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full py-2.5 border-2 border-dashed border-border-default rounded-xl text-sm text-text-secondary hover:border-border-input hover:text-text-primary transition-colors"
      >
        + Add a section
      </button>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-card-bg rounded-xl border border-border-default p-4 space-y-3"
    >
      <TextInput
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Section name..."
        autoFocus
      />
      <div className="flex flex-wrap gap-2">
        {sectionTypes.map((st) => (
          <button
            key={st.value}
            type="button"
            onClick={() => setType(st.value)}
            className={`px-3 py-1 rounded-pill text-xs transition-colors ${
              type === st.value
                ? 'bg-primary-subtle-bg text-primary-subtle-text font-medium'
                : 'bg-card-bg-inset text-text-secondary hover:text-text-primary'
            }`}
          >
            {st.label}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm">
          Add
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
