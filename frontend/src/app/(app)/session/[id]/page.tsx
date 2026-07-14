'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useApi } from '@/lib/useApi'
import { Button, Dialog, ProgressBar } from '@/components/ui'
import {
  SectionCard,
  AddSectionButton,
  SessionNotes,
} from '@/components/session'
import { getSectionColor } from '@/lib/section-colors'
import type { PracticeLog, FinishResponse } from '@/lib/types'

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
  const [confirmingEnd, setConfirmingEnd] = useState(false)
  // Track which block_ids are repertoire blocks. Once a block_id is seen
  // with spot_id set, it's repertoire forever (even after collapse removes
  // the spot logs). This survives the collapse→expand round trip.
  const repertoireBlockIds = useRef(new Set<number>())

  const fetchLog = useCallback(async () => {
    try {
      setLoading(true)
      const data = await apiRef.current.getPractice(logId)
      // Learn which block_ids are repertoire from any spot-level logs
      for (const sl of data.section_logs) {
        for (const bl of sl.block_logs) {
          if (bl.spot_id !== null && bl.block_id !== null) {
            repertoireBlockIds.current.add(bl.block_id)
          }
        }
      }
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

  const handleEndSession = async () => {
    if (!log) return
    setConfirmingEnd(false)
    try {
      await apiRef.current.updatePractice(log.id, { status: 'abandoned' })
    } catch {
      // Navigate anyway — the session can be cleaned up later
    }
    router.push('/today')
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-text-secondary">
        Loading session…
      </div>
    )
  }

  if (error || !log) {
    return (
      <div className="py-16 text-center">
        <p className="mb-3 text-danger-text">{error || 'Session not found'}</p>
        <Link href="/today" className="text-sm text-text-link hover:text-text-primary">
          Back to Today
        </Link>
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

  // Section colors: pinned warm-up/cool-down plus the pool by display order.
  let nonPinnedIndex = 0

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border-default pb-3">
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-text-primary">
          {log.session_name ?? log.template_name ?? 'Practice session'}
        </h1>
        <button
          onClick={() => setConfirmingEnd(true)}
          className="flex-shrink-0 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          End session
        </button>
      </div>

      {/* Progress */}
      <div>
        <div className="mb-1 flex justify-between text-xs text-text-secondary">
          <span>
            {completedCount} of {totalCount} done
          </span>
          <span>Total: {totalMinutes} min</span>
        </div>
        <ProgressBar
          value={totalCount > 0 ? completedCount / totalCount : 0}
          label={`${completedCount} of ${totalCount} exercises done`}
        />
      </div>

      {/* Sections */}
      {log.section_logs.map((sl) => {
        const isPinned =
          sl.section_type === 'warmup' || sl.section_type === 'cooldown'
        const color = getSectionColor(sl.section_type, isPinned ? 0 : nonPinnedIndex)
        if (!isPinned) nonPinnedIndex++
        return (
          <SectionCard
            key={sl.id}
            logId={log.id}
            sectionLog={sl}
            color={color}
            onUpdate={fetchLog}
            pendingFlushes={pendingFlushes}
            repertoireBlockIds={repertoireBlockIds}
          />
        )
      })}

      {/* Add freeform section */}
      <AddSectionButton logId={log.id} onAdd={fetchLog} />

      {/* Session notes */}
      <SessionNotes
        logId={log.id}
        initialNotes={log.notes ?? ''}
        pendingFlushes={pendingFlushes}
      />

      {/* Finish button */}
      <Button
        variant="primary"
        fullWidth
        onClick={handleFinish}
        disabled={finishing}
      >
        {finishing ? 'Finishing…' : 'Finish session'}
      </Button>

      {/* End-session confirmation */}
      {confirmingEnd && (
        <Dialog
          onClose={() => setConfirmingEnd(false)}
          aria-labelledby="end-session-title"
          className="w-full max-w-sm rounded-xl bg-card-bg p-6 shadow-2xl"
        >
          <h2
            id="end-session-title"
            className="mb-2 text-lg font-semibold text-text-primary"
          >
            End this session?
          </h2>
          <p className="mb-6 text-sm text-text-secondary">
            Your progress won&apos;t be saved as a completed session. You can
            start a new one anytime.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmingEnd(false)}
            >
              Keep going
            </Button>
            <Button variant="danger" size="sm" onClick={handleEndSession}>
              End session
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  )
}
