'use client'

import { useState } from 'react'
import { useApi } from '@/lib/useApi'
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
        className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-gray-400 hover:text-gray-600 transition-colors"
      >
        + Add a section
      </button>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3"
    >
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Section name..."
        autoFocus
        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-primary-400"
      />
      <div className="flex flex-wrap gap-2">
        {sectionTypes.map((st) => (
          <button
            key={st.value}
            type="button"
            onClick={() => setType(st.value)}
            className={`px-3 py-1 rounded-full text-xs transition-colors ${
              type === st.value
                ? 'bg-primary-100 text-primary-700 font-medium'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {st.label}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          className="px-4 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700"
        >
          Add
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-4 py-1.5 text-gray-500 text-sm hover:text-gray-700"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
