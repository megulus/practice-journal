'use client'

import { useEffect, useState, useCallback } from 'react'
import { useApi } from '@/lib/useApi'

// ---------------------------------------------------------------------------
// Session notes
// ---------------------------------------------------------------------------

export function SessionNotes({
  logId,
  initialNotes,
  pendingFlushes,
}: {
  logId: number
  initialNotes: string
  pendingFlushes: React.RefObject<Set<() => Promise<void>>>
}) {
  const api = useApi()
  const [notes, setNotes] = useState(initialNotes)

  const handleSave = useCallback(async () => {
    await api.updatePractice(logId, { notes: notes || undefined })
  }, [api, logId, notes])

  // Register flush so Finish saves pending session notes
  useEffect(() => {
    const flushes = pendingFlushes.current
    if (notes !== initialNotes) {
      flushes?.add(handleSave)
      return () => { flushes?.delete(handleSave) }
    }
  }, [notes, initialNotes, handleSave, pendingFlushes])

  return (
    <div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={handleSave}
        placeholder="Notes — breakthroughs, challenges, ideas..."
        rows={3}
        className="w-full text-sm text-gray-700 border border-gray-200 rounded-xl px-4 py-3 resize-none focus:outline-none focus:border-primary-400"
      />
    </div>
  )
}
