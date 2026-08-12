'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useApi } from '@/lib/useApi'
import AddBlockSheet, { type BlockLibraryTab } from '@/components/AddBlockSheet'
import { VoiceInput, useDictation } from '@/components/ui'
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

  // Form field: committed on submit, so no onCommit persistence here.
  const dictation = useDictation({ value: name, onChange: setName })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    await addBlock(trimmed)
    setName('')
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 px-4 py-2 border-t border-border-subtle"
      >
        <input
          type="text"
          value={dictation.value}
          onChange={(e) => dictation.onChange(e.target.value)}
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
        <VoiceInput {...dictation.voiceProps} aria-label="Dictate exercise name" />
        {/* type="button": inside the form, but it opens the sheet rather than
            submitting the typed name. */}
        {instrument && (
          <button
            type="button"
            onClick={() => setBrowsing(true)}
            className="flex-shrink-0 text-[11px] text-text-link hover:underline"
          >
            Browse library
          </button>
        )}
      </form>

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
