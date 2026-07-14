'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useApi } from '@/lib/useApi'
import {
  SectionCard,
  AddSectionButton,
  SessionNotes,
} from '@/components/session'
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
            repertoireBlockIds={repertoireBlockIds}
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
