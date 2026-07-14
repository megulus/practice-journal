'use client'

import { useEffect, useState, useCallback } from 'react'
import { useApi } from '@/lib/useApi'
import { Checkbox, RatingChevrons, TextArea } from '@/components/ui'
import type { BlockLog, Rating } from '@/lib/types'

// ---------------------------------------------------------------------------
// Block row (exercise)
// ---------------------------------------------------------------------------

export function BlockRow({
  logId,
  blockLog,
  onUpdate,
  pendingFlushes,
}: {
  logId: number
  blockLog: BlockLog
  onUpdate: () => void
  pendingFlushes: React.RefObject<Set<() => Promise<void>>>
}) {
  const api = useApi()
  const [showNotes, setShowNotes] = useState(!!blockLog.notes)
  const [notes, setNotes] = useState(blockLog.notes ?? '')
  const [savingNotes, setSavingNotes] = useState(false)

  const handleToggleCompleted = async () => {
    await api.updateBlockLog(logId, blockLog.id, {
      completed: !blockLog.completed,
    })
    onUpdate()
  }

  const handleRating = async (rating: Rating) => {
    await api.updateBlockLog(logId, blockLog.id, {
      rating,
      completed: true,
    })
    onUpdate()
  }

  const handleSaveNotes = useCallback(async () => {
    setSavingNotes(true)
    try {
      await api.updateBlockLog(logId, blockLog.id, { notes })
    } finally {
      setSavingNotes(false)
    }
  }, [api, logId, blockLog.id, notes])

  // Register/unregister the flush callback so Finish can save pending notes
  useEffect(() => {
    const flushes = pendingFlushes.current
    if (showNotes && notes !== (blockLog.notes ?? '')) {
      flushes?.add(handleSaveNotes)
      return () => { flushes?.delete(handleSaveNotes) }
    }
  }, [showNotes, notes, blockLog.notes, handleSaveNotes, pendingFlushes])

  return (
    <div className={`px-4 py-3 ${blockLog.completed ? 'bg-card-bg-inset' : ''}`}>
      <div className="flex items-center gap-3">
        {/* Checkbox */}
        <Checkbox
          checked={blockLog.completed}
          onChange={handleToggleCompleted}
          aria-label={blockLog.completed ? 'Mark incomplete' : 'Mark complete'}
          className="flex-shrink-0"
        />

        {/* Name + metadata */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm ${blockLog.completed ? 'text-text-tertiary' : 'text-text-primary'}`}>
            {blockLog.block_name}
          </p>
          {blockLog.last_tempo_bpm && (
            <p className="text-xs text-text-tertiary">
              Last tempo: {blockLog.last_tempo_bpm} bpm
            </p>
          )}
        </div>

        {/* Rating */}
        <RatingChevrons
          value={blockLog.rating}
          onChange={handleRating}
        />
      </div>

      {/* Notes toggle + field */}
      <div className="mt-1 ml-8">
        {!showNotes ? (
          <button
            onClick={() => setShowNotes(true)}
            className="text-xs text-text-tertiary hover:text-text-secondary transition-colors"
          >
            + add note
          </button>
        ) : (
          <div className="mt-1">
            <TextArea
              variant="recessed"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleSaveNotes}
              placeholder="Notes..."
              rows={2}
            />
            {savingNotes && (
              <span className="text-xs text-text-tertiary">Saving...</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
