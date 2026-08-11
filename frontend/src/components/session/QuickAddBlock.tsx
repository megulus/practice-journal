'use client'

import { useState } from 'react'
import { useApi } from '@/lib/useApi'
import AddBlockSheet, { type BlockLibraryTab } from '@/components/AddBlockSheet'
import type { BlockCreate, Instrument } from '@/lib/types'

// ---------------------------------------------------------------------------
// Quick-add block
// ---------------------------------------------------------------------------

/**
 * The library sheet's standard-block tabs. Repertoire is deliberately absent
 * mid-session: the only endpoint for adding a block to a live session
 * (`POST /practice/{logId}/sections/{sectionLogId}/blocks`) takes a name and
 * creates a block log with `block_id` null, so it can't attach a piece — and
 * repertoire mid-session is `RepertoireBlock`'s "Add a spot" flow anyway
 * (#182, out of scope). Module-level so the prop identity is stable.
 */
const SESSION_TABS: BlockLibraryTab[] = ['curated', 'recent']

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

  // `BlockCreate` is a union, and only the standard variant can become a block
  // log mid-session. The sheet is scoped so the repertoire variant can't be
  // returned here; the exhaustiveness check keeps that a compile error rather
  // than a runtime surprise if a third variant is ever added.
  const handleLibraryPick = async (data: BlockCreate) => {
    if ('name' in data) {
      await addBlock(data.name)
      return
    }
    if ('piece_id' in data) {
      throw new Error(
        'Repertoire blocks cannot be added mid-session — use "Add a spot" on the piece.'
      )
    }
    const unhandled: never = data
    throw new Error(`Unhandled block type: ${JSON.stringify(unhandled)}`)
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
            className="flex-shrink-0 text-[11px] text-text-link hover:underline"
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
          tabs={SESSION_TABS}
          onAdd={handleLibraryPick}
          onClose={() => setBrowsing(false)}
        />
      )}
    </>
  )
}
