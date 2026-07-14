'use client'

import { useState } from 'react'
import { useApi } from '@/lib/useApi'

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
    <form onSubmit={handleSubmit} className="px-4 py-2 border-t border-gray-100">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Add something else..."
        className="w-full text-xs text-gray-600 bg-transparent py-1 focus:outline-none placeholder-gray-400"
      />
    </form>
  )
}
