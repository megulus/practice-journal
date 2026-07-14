'use client'

import { useEffect, useState, useCallback } from 'react'
import { useApi } from '@/lib/useApi'
import { RatingChevrons } from '@/components/ui'
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
    <div className={`px-4 py-3 ${!blockLog.completed ? '' : 'bg-gray-50/50'}`}>
      <div className="flex items-center gap-3">
        {/* Checkbox */}
        <button
          onClick={handleToggleCompleted}
          className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${
            blockLog.completed
              ? 'bg-primary-600 border-primary-600 text-white'
              : 'border-gray-300 hover:border-primary-400'
          }`}
          aria-label={blockLog.completed ? 'Mark incomplete' : 'Mark complete'}
        >
          {blockLog.completed && (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          )}
        </button>

        {/* Name + metadata */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm ${blockLog.completed ? 'text-gray-500' : 'text-gray-900'}`}>
            {blockLog.block_name}
          </p>
          {blockLog.last_tempo_bpm && (
            <p className="text-xs text-gray-400">
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
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            + add note
          </button>
        ) : (
          <div className="mt-1">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleSaveNotes}
              placeholder="Notes..."
              rows={2}
              className="w-full text-xs text-gray-700 border border-gray-200 rounded-lg px-2.5 py-1.5 resize-none focus:outline-none focus:border-primary-400"
            />
            {savingNotes && (
              <span className="text-xs text-gray-400">Saving...</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
