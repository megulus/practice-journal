'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useApi } from '@/lib/useApi'
import { VoiceInput, appendTranscript } from '@/components/ui'

// ---------------------------------------------------------------------------
// Quick-add block
// ---------------------------------------------------------------------------

export function QuickAddBlock({
  logId,
  sectionLogId,
  onAdd,
}: {
  logId: number
  sectionLogId: number
  onAdd: () => void
}) {
  const api = useApi()
  const [name, setName] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    await api.addFreeformBlock(logId, sectionLogId, { block_name: trimmed })
    setName('')
    onAdd()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 px-4 py-2 border-t border-border-subtle"
    >
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Add an exercise…"
        className="flex-1 min-w-0 text-xs text-text-secondary bg-transparent py-1 focus:outline-none placeholder:text-text-tertiary"
      />
      {/* Dictated text can't be submitted with Enter, so quick-add needs an
          explicit submit affordance (design-tokens §6 Quick-add block). */}
      <button
        type="submit"
        disabled={!name.trim()}
        aria-label="Add exercise"
        className="flex-shrink-0 text-text-secondary transition-colors hover:text-text-primary disabled:text-text-tertiary"
      >
        <Plus size={16} aria-hidden />
      </button>
      <VoiceInput
        onTranscript={(text) => setName((prev) => appendTranscript(prev, text))}
        aria-label="Dictate exercise name"
      />
    </form>
  )
}
