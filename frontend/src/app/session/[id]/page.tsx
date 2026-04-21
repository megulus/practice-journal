'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useApi } from '@/lib/useApi'
import RatingChevrons from '@/components/RatingChevrons'
import TimeStepper from '@/components/TimeStepper'
import RepertoireBlock from '@/components/RepertoireBlock'
import type {
  PracticeLog,
  SectionLog,
  BlockLog,
  Rating,
  FinishResponse,
  SectionType,
} from '@/lib/types'

export default function ActiveSessionPage() {
  const api = useApi()
  const apiRef = useRef(api)
  apiRef.current = api

  const router = useRouter()
  const params = useParams()
  const logId = Number(params.id)

  const [log, setLog] = useState<PracticeLog | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [finishing, setFinishing] = useState(false)

  const fetchLog = useCallback(async () => {
    try {
      setLoading(true)
      const data = await apiRef.current.getPractice(logId)
      setLog(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session')
    } finally {
      setLoading(false)
    }
  }, [logId])

  useEffect(() => {
    if (logId) fetchLog()
  }, [logId, fetchLog])

  // Collect pending note-save callbacks so we can flush before finish
  const pendingFlushes = useRef<Set<() => Promise<void>>>(new Set())

  const handleFinish = async () => {
    if (!log) return
    setFinishing(true)
    try {
      // Flush any unsaved notes (covers the case where the user taps
      // Finish without blurring a note field first)
      const flushes = Array.from(pendingFlushes.current)
      await Promise.all(flushes.map((fn) => fn()))

      const result: FinishResponse = await apiRef.current.finishPractice(log.id)
      // Navigate to summary with the finish data
      // For now, store in sessionStorage since we don't have a summary page yet
      sessionStorage.setItem(
        `session-summary-${log.id}`,
        JSON.stringify(result)
      )
      router.push(`/session/${log.id}/summary`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to finish session')
      setFinishing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="text-gray-500">Loading session...</div>
      </div>
    )
  }

  if (error || !log) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] px-6">
        <div className="text-center">
          <p className="text-red-600 mb-3">{error || 'Session not found'}</p>
          <Link href="/today" className="text-primary-600 underline text-sm">
            Back to Today
          </Link>
        </div>
      </div>
    )
  }

  // Compute progress
  const allBlocks = log.section_logs.flatMap((sl) => sl.block_logs)
  const completedCount = allBlocks.filter((bl) => bl.completed).length
  const totalCount = allBlocks.length
  const totalMinutes = log.section_logs.reduce(
    (sum, sl) => sum + sl.actual_duration_minutes,
    0
  )

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="sticky top-0 bg-white border-b border-gray-200 z-40 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-gray-900 truncate">
              {log.session_name ?? log.template_name ?? 'Practice session'}
            </h1>
          </div>
          <button
            onClick={async () => {
              if (confirm('Abandon this session?')) {
                try {
                  await apiRef.current.updatePractice(log.id, { status: 'abandoned' })
                } catch {
                  // Navigate anyway — the session can be cleaned up later
                }
                router.push('/today')
              }
            }}
            className="text-sm text-gray-500 hover:text-gray-700 ml-3"
          >
            End session
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-white border-b border-gray-100 px-4 py-2">
        <div className="max-w-lg mx-auto">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>
              {completedCount} of {totalCount} done
            </span>
            <span>Total: {totalMinutes} min</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 rounded-full transition-all duration-300"
              style={{
                width: totalCount > 0
                  ? `${(completedCount / totalCount) * 100}%`
                  : '0%',
              }}
            />
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {log.section_logs.map((sl) => (
          <SectionCard
            key={sl.id}
            logId={log.id}
            sectionLog={sl}
            onUpdate={fetchLog}
            pendingFlushes={pendingFlushes}
          />
        ))}

        {/* Add freeform section */}
        <AddSectionButton logId={log.id} onAdd={fetchLog} />

        {/* Session notes */}
        <SessionNotes
          logId={log.id}
          initialNotes={log.notes ?? ''}
          pendingFlushes={pendingFlushes}
        />

        {/* Finish button */}
        <button
          onClick={handleFinish}
          disabled={finishing}
          className="w-full py-3 bg-primary-600 text-white rounded-xl font-medium text-base hover:bg-primary-700 transition-colors shadow-sm disabled:opacity-60"
        >
          {finishing ? 'Finishing...' : 'Finish session'}
        </button>
      </div>
    </main>
  )
}

// ---------------------------------------------------------------------------
// Section card
// ---------------------------------------------------------------------------

function SectionCard({
  logId,
  sectionLog,
  onUpdate,
  pendingFlushes,
}: {
  logId: number
  sectionLog: SectionLog
  onUpdate: () => void
  pendingFlushes: React.RefObject<Set<() => Promise<void>>>
}) {
  const api = useApi()
  const isCompleted = sectionLog.completed
  const isSkipped = !sectionLog.completed && sectionLog.block_logs.every((bl) => !bl.completed)

  const handleTimeChange = async (minutes: number) => {
    await api.updateSectionLog(logId, sectionLog.id, {
      actual_duration_minutes: minutes,
    })
    onUpdate()
  }

  const handleMarkAllDone = async () => {
    await api.updateSectionLog(logId, sectionLog.id, { mark_all_done: true })
    onUpdate()
  }

  const handleSkipSection = async () => {
    const hasRatings = sectionLog.block_logs.some((bl) => bl.rating !== null)
    if (hasRatings && !confirm('Skipping will clear ratings in this section. Continue?')) {
      return
    }
    await api.updateSectionLog(logId, sectionLog.id, { completed: false })
    onUpdate()
  }

  return (
    <div
      className={`bg-white rounded-xl border border-gray-200 shadow-sm transition-opacity ${
        isSkipped ? 'opacity-50' : isCompleted ? 'opacity-75' : ''
      }`}
    >
      {/* Section header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2 min-w-0">
          <SectionTypeIcon type={sectionLog.section_type} />
          <h3 className="font-medium text-gray-900 text-sm truncate">
            {sectionLog.section_name}
          </h3>
        </div>
        <TimeStepper
          value={sectionLog.actual_duration_minutes}
          onChange={handleTimeChange}
        />
      </div>

      {/* Section actions */}
      <div className="flex gap-4 px-4 py-1.5 border-b border-gray-50">
        <button
          onClick={handleMarkAllDone}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          Mark all done
        </button>
        <button
          onClick={handleSkipSection}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          Skip section
        </button>
      </div>

      {/* Block rows — standard blocks render individually, repertoire
          blocks (same block_id, spot_id set) are grouped into a RepertoireBlock */}
      <div className="divide-y divide-gray-50">
        {groupBlockLogs(sectionLog.block_logs).map((group) =>
          group.type === 'standard' ? (
            <BlockRow
              key={group.blockLog.id}
              logId={logId}
              blockLog={group.blockLog}
              onUpdate={onUpdate}
              pendingFlushes={pendingFlushes}
            />
          ) : (
            <RepertoireBlock
              key={`rep-${group.blockId}`}
              logId={logId}
              blockId={group.blockId}
              pieceName={group.pieceName}
              spotLogs={group.spotLogs}
              pieceLog={group.pieceLog}
              onUpdate={onUpdate}
              pendingFlushes={pendingFlushes}
            />
          )
        )}
      </div>

      {/* Quick-add block */}
      <QuickAddBlock
        logId={logId}
        sectionLogId={sectionLog.id}
        onAdd={onUpdate}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Block row (exercise)
// ---------------------------------------------------------------------------

function BlockRow({
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

// ---------------------------------------------------------------------------
// Quick-add block
// ---------------------------------------------------------------------------

function QuickAddBlock({
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

// ---------------------------------------------------------------------------
// Add freeform section
// ---------------------------------------------------------------------------

function AddSectionButton({
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

// ---------------------------------------------------------------------------
// Session notes
// ---------------------------------------------------------------------------

function SessionNotes({
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

// ---------------------------------------------------------------------------
// Section type icon (colored dot)
// ---------------------------------------------------------------------------

function SectionTypeIcon({ type }: { type: string }) {
  const colors: Record<string, string> = {
    warmup: 'bg-orange-400',
    scales: 'bg-blue-400',
    repertoire: 'bg-purple-400',
    sight_reading: 'bg-green-400',
    ear_training: 'bg-cyan-400',
    cooldown: 'bg-indigo-400',
    other: 'bg-gray-400',
  }
  return (
    <span
      className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${colors[type] ?? 'bg-gray-400'}`}
    />
  )
}

// ---------------------------------------------------------------------------
// Block log grouping — identifies repertoire blocks (shared block_id +
// spot_id set) and groups them for rendering as a RepertoireBlock.
// ---------------------------------------------------------------------------

type BlockGroup =
  | { type: 'standard'; blockLog: BlockLog }
  | {
      type: 'repertoire'
      blockId: number
      pieceName: string
      spotLogs: BlockLog[]
      pieceLog: BlockLog | null
    }

function groupBlockLogs(blockLogs: BlockLog[]): BlockGroup[] {
  const groups: BlockGroup[] = []
  const repGroups = new Map<
    number,
    { spotLogs: BlockLog[]; pieceLog: BlockLog | null }
  >()

  // First pass: identify repertoire block_ids (multiple logs sharing the
  // same non-null block_id, or a single log with spot_id set)
  const blockIdCounts = new Map<number, number>()
  for (const bl of blockLogs) {
    if (bl.block_id !== null) {
      blockIdCounts.set(bl.block_id, (blockIdCounts.get(bl.block_id) ?? 0) + 1)
    }
  }

  // A block is repertoire if: it has spot_id, OR there are multiple logs
  // sharing the same block_id (multi-spot), OR it's a piece-level log
  // from a collapsed repertoire block.
  const isRepertoireBlockId = (bl: BlockLog): boolean => {
    if (bl.spot_id !== null) return true
    if (bl.block_id !== null && (blockIdCounts.get(bl.block_id) ?? 0) > 1) return true
    // A piece-level log (spot_id null) from a repertoire block: detect by
    // checking if the block_name contains " — " (spot logs) or if other
    // logs in the same block_id have spot_id set.
    return false
  }

  // Second pass: group
  const seen = new Set<number>()
  for (const bl of blockLogs) {
    if (bl.block_id !== null && isRepertoireBlockId(bl)) {
      if (!seen.has(bl.block_id)) {
        seen.add(bl.block_id)
        repGroups.set(bl.block_id, { spotLogs: [], pieceLog: null })
      }
      const group = repGroups.get(bl.block_id)!
      if (bl.spot_id !== null) {
        group.spotLogs.push(bl)
      } else {
        group.pieceLog = bl
      }
    }
  }

  // Third pass: build output in order, replacing repertoire logs with groups
  const emitted = new Set<number>()
  for (const bl of blockLogs) {
    if (bl.block_id !== null && repGroups.has(bl.block_id)) {
      if (!emitted.has(bl.block_id)) {
        emitted.add(bl.block_id)
        const group = repGroups.get(bl.block_id)!
        // Extract piece name from the first spot log or piece log
        const firstLog = group.spotLogs[0] ?? group.pieceLog
        const pieceName = firstLog
          ? firstLog.block_name.split(' \u2014 ')[0]
          : 'Unknown piece'
        groups.push({
          type: 'repertoire',
          blockId: bl.block_id,
          pieceName,
          spotLogs: group.spotLogs,
          pieceLog: group.pieceLog,
        })
      }
    } else {
      groups.push({ type: 'standard', blockLog: bl })
    }
  }

  return groups
}
