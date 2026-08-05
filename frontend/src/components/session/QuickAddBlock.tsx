'use client'

import { useState } from 'react'
import { useApi } from '@/lib/useApi'
import AddBlockSheet from '@/components/AddBlockSheet'
import type { Instrument } from '@/lib/types'

// ---------------------------------------------------------------------------
// Quick-add block
// ---------------------------------------------------------------------------

export function QuickAddBlock({
  logId,
  sectionLogId,
  sectionName,
  instrument,
  onAdd,
}: {
  logId: number
  sectionLogId: number
  sectionName: string
  /** Needed by the library sheet (curated blocks are keyed by category). The
   * "Browse library" link is hidden until the session's instrument loads. */
  instrument: Instrument | null
  onAdd: () => void
}) {
  const api = useApi()
  const [name, setName] = useState('')
  const [browsing, setBrowsing] = useState(false)

  const addBlock = async (blockName: string) => {
    await api.addFreeformBlock(logId, sectionLogId, { block_name: blockName })
    onAdd()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    await addBlock(trimmed)
    setName('')
  }

  return (
    <>
      <div className="flex items-center gap-2 px-4 py-2 border-t border-border-subtle">
        <form onSubmit={handleSubmit} className="min-w-0 flex-1">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Add an exercise…"
            className="w-full text-xs text-text-secondary bg-transparent py-1 focus:outline-none placeholder:text-text-tertiary"
          />
        </form>
        {instrument && (
          <button
            type="button"
            onClick={() => setBrowsing(true)}
            className="flex-shrink-0 text-xs text-text-link hover:underline"
          >
            Browse library
          </button>
        )}
      </div>

      {/* Library sheet — a picked block lands as a freeform block log, same as
          the quick-add input (blocks added mid-session aren't in the plan). */}
      {browsing && instrument && (
        <AddBlockSheet
          sectionName={sectionName}
          instrumentCategory={instrument.instrument_category}
          instrumentId={instrument.id}
          onAdd={(data) => addBlock(data.name)}
          onClose={() => setBrowsing(false)}
        />
      )}
    </>
  )
}
