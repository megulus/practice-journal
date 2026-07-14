'use client'

import { useState, useCallback, useEffect } from 'react'
import { Check, Minus, ChevronDown } from 'lucide-react'
import { useApi } from '@/lib/useApi'
import { Checkbox, RatingChevrons, TextArea, TextInput } from '@/components/ui'
import type { BlockLog, Rating } from '@/lib/types'

/**
 * A repertoire block in the active session: piece header with a
 * three-state checkbox, collapsible spot list, whole-piece mode toggle,
 * and inline spot creation.
 *
 * Props:
 * - pieceName: extracted from the first blockLog's block_name (before " — ")
 * - spotLogs: the BlockLog[] that belong to this piece (same block_id, spot_id set)
 * - pieceLog: a piece-level BlockLog (spot_id null) if in whole-piece mode, else null
 */
export default function RepertoireBlock({
  logId,
  blockId,
  pieceName,
  spotLogs,
  pieceLog,
  onUpdate,
  pendingFlushes,
}: {
  logId: number
  blockId: number
  pieceName: string
  spotLogs: BlockLog[]
  pieceLog: BlockLog | null
  onUpdate: () => void
  pendingFlushes: React.RefObject<Set<() => Promise<void>>>
}) {
  const api = useApi()
  const [collapsed, setCollapsed] = useState(false)
  const [addingSpot, setAddingSpot] = useState(false)
  const [newSpotName, setNewSpotName] = useState('')
  const [saveForNextTime, setSaveForNextTime] = useState(true)

  const isWholePieceMode = pieceLog !== null && spotLogs.length === 0

  // Determine piece checkbox state
  const checkedSpotCount = spotLogs.filter((bl) => bl.completed).length
  const checkboxState: 'unchecked' | 'indeterminate' | 'checked' =
    isWholePieceMode
      ? 'checked'
      : checkedSpotCount === 0
        ? 'unchecked'
        : checkedSpotCount === spotLogs.length
          ? 'unchecked' // all spots checked individually, piece checkbox stays unchecked
          : 'indeterminate'

  const handlePieceCheckbox = async () => {
    if (isWholePieceMode) {
      // Expand back to spots
      try {
        await api.expandToSpots(logId, pieceLog!.id)
        onUpdate()
      } catch {
        // silent
      }
    } else {
      // Collapse to piece
      const firstSpot = spotLogs[0]
      if (!firstSpot) return
      try {
        await api.collapseToPiece(logId, firstSpot.id)
        onUpdate()
      } catch {
        // silent
      }
    }
  }

  const handleAddSpot = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newSpotName.trim()
    if (!trimmed || spotLogs.length === 0) return
    try {
      await api.addSpotMidSession(logId, spotLogs[0].id, {
        name: trimmed,
        add_to_rotation: saveForNextTime,
      })
      setNewSpotName('')
      setAddingSpot(false)
      onUpdate()
    } catch {
      // silent
    }
  }

  return (
    <div className="py-2">
      {/* Piece header */}
      <div className="flex items-center gap-3 px-4 py-2">
        {/* Three-state checkbox */}
        <button
          role="checkbox"
          aria-checked={
            isWholePieceMode ? 'true' : checkboxState === 'indeterminate' ? 'mixed' : 'false'
          }
          onClick={handlePieceCheckbox}
          className={`w-5 h-5 rounded-[4px] border flex items-center justify-center flex-shrink-0 transition-colors ${
            isWholePieceMode
              ? 'bg-primary border-primary text-text-on-primary-action'
              : checkboxState === 'indeterminate'
                ? 'bg-text-tertiary border-text-tertiary text-text-on-primary-action'
                : 'border-border-input hover:border-border-input-focus'
          }`}
          aria-label={
            isWholePieceMode
              ? 'Switch to per-spot logging'
              : 'Log as one piece'
          }
        >
          {isWholePieceMode && <Check size={12} strokeWidth={3} aria-hidden />}
          {checkboxState === 'indeterminate' && (
            <Minus size={12} strokeWidth={3} aria-hidden />
          )}
        </button>

        {/* Piece name */}
        <span className="flex-1 font-medium text-sm text-text-primary">
          {pieceName}
        </span>

        {/* Collapse chevron */}
        {!isWholePieceMode && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-text-tertiary hover:text-text-secondary p-1 transition-colors"
            aria-label={collapsed ? 'Expand spots' : 'Collapse spots'}
          >
            <ChevronDown
              size={16}
              className={`transition-transform ${collapsed ? '-rotate-90' : ''}`}
              aria-hidden
            />
          </button>
        )}
      </div>

      {/* Whole-piece mode: single rating row */}
      {isWholePieceMode && pieceLog && (
        <WholePieceRating
          logId={logId}
          blockLog={pieceLog}
          onUpdate={onUpdate}
          pendingFlushes={pendingFlushes}
        />
      )}

      {/* Per-spot mode: spot rows */}
      {!isWholePieceMode && !collapsed && (
        <div className={`ml-4 ${isWholePieceMode ? 'opacity-30 pointer-events-none' : ''}`}>
          {spotLogs.map((bl) => (
            <SpotRow
              key={bl.id}
              logId={logId}
              blockLog={bl}
              onUpdate={onUpdate}
              pendingFlushes={pendingFlushes}
            />
          ))}

          {/* Add spot */}
          {!addingSpot ? (
            <button
              onClick={() => setAddingSpot(true)}
              className="px-4 py-1.5 text-xs text-text-tertiary hover:text-text-secondary transition-colors"
            >
              + Add spot
            </button>
          ) : (
            <form onSubmit={handleAddSpot} className="px-4 py-2 space-y-2">
              <TextInput
                variant="recessed"
                value={newSpotName}
                onChange={(e) => setNewSpotName(e.target.value)}
                placeholder="Add a spot..."
                autoFocus
              />
              <Checkbox
                checked={saveForNextTime}
                onChange={(e) => setSaveForNextTime(e.target.checked)}
                label="Save for next time"
              />
              <div className="flex gap-3 items-center">
                <button
                  type="submit"
                  disabled={!newSpotName.trim()}
                  className="text-xs text-text-link font-medium disabled:text-text-tertiary"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => { setAddingSpot(false); setNewSpotName('') }}
                  className="text-xs text-text-secondary hover:text-text-primary transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Collapsed count */}
      {!isWholePieceMode && collapsed && (
        <p className="px-4 ml-8 text-xs text-text-tertiary">
          {spotLogs.length} spot{spotLogs.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Spot row (similar to BlockRow but indented, with optional location)
// ---------------------------------------------------------------------------

function SpotRow({
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

  // Extract spot name from "Piece — Spot" format
  const parts = blockLog.block_name.split(' — ')
  const spotName = parts.length > 1 ? parts.slice(1).join(' — ') : blockLog.block_name

  const handleToggle = async () => {
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

  useEffect(() => {
    const flushes = pendingFlushes.current
    if (showNotes && notes !== (blockLog.notes ?? '')) {
      flushes?.add(handleSaveNotes)
      return () => { flushes?.delete(handleSaveNotes) }
    }
  }, [showNotes, notes, blockLog.notes, handleSaveNotes, pendingFlushes])

  return (
    <div className={`px-4 py-2 ${blockLog.completed ? 'bg-card-bg-inset' : ''}`}>
      <div className="flex items-center gap-3">
        <Checkbox
          checked={blockLog.completed}
          onChange={handleToggle}
          aria-label={blockLog.completed ? 'Mark incomplete' : 'Mark complete'}
          className="flex-shrink-0"
        />

        <div className="flex-1 min-w-0">
          <p className={`text-sm ${blockLog.completed ? 'text-text-tertiary' : 'text-text-primary'}`}>
            {spotName}
          </p>
        </div>

        <RatingChevrons value={blockLog.rating} onChange={handleRating} />
      </div>

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

// ---------------------------------------------------------------------------
// Whole-piece rating row
// ---------------------------------------------------------------------------

function WholePieceRating({
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

  const handleRating = async (rating: Rating) => {
    await api.updateBlockLog(logId, blockLog.id, {
      rating,
      completed: true,
    })
    onUpdate()
  }

  const handleSaveNotes = useCallback(async () => {
    await api.updateBlockLog(logId, blockLog.id, { notes })
  }, [api, logId, blockLog.id, notes])

  useEffect(() => {
    const flushes = pendingFlushes.current
    if (showNotes && notes !== (blockLog.notes ?? '')) {
      flushes?.add(handleSaveNotes)
      return () => { flushes?.delete(handleSaveNotes) }
    }
  }, [showNotes, notes, blockLog.notes, handleSaveNotes, pendingFlushes])

  return (
    <div className="px-4 py-2 ml-8">
      <div className="flex items-center gap-3">
        <span className="text-xs text-text-tertiary italic flex-1">
          Logging as one piece
        </span>
        <RatingChevrons value={blockLog.rating} onChange={handleRating} />
      </div>
      <div className="mt-1">
        {!showNotes ? (
          <button
            onClick={() => setShowNotes(true)}
            className="text-xs text-text-tertiary hover:text-text-secondary transition-colors"
          >
            + add note
          </button>
        ) : (
          <TextArea
            variant="recessed"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleSaveNotes}
            placeholder="Notes..."
            rows={2}
          />
        )}
      </div>
    </div>
  )
}
