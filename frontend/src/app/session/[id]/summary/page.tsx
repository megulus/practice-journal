'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useApi } from '@/lib/useApi'
import type { FinishResponse } from '@/lib/types'

export default function SessionSummaryPage() {
  const router = useRouter()
  const params = useParams()
  const api = useApi()
  const logId = Number(params.id)

  const [data, setData] = useState<FinishResponse | null>(null)
  const [reflection, setReflection] = useState('')
  const [reflectionSaved, setReflectionSaved] = useState(false)

  useEffect(() => {
    // Try to load from sessionStorage (set by the finish flow)
    const cached = sessionStorage.getItem(`session-summary-${logId}`)
    if (cached) {
      try {
        setData(JSON.parse(cached))
        sessionStorage.removeItem(`session-summary-${logId}`)
        return
      } catch {
        // fall through to redirect
      }
    }
    // If no cached data, we can't show the summary — redirect to today
    router.replace('/today')
  }, [logId, router])

  const handleSaveReflection = async () => {
    if (!reflection.trim()) return
    try {
      await api.saveReflection(logId, { reflection_response: reflection })
      setReflectionSaved(true)
    } catch {
      // silently fail — not critical
    }
  }

  if (!data) return null

  const { summary, coaching_suggestion, reflection_prompt } = data
  const { ratings } = summary

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="max-w-lg mx-auto">
        <h1 className="text-xl font-semibold text-gray-900 mb-6">
          Session complete
        </h1>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <StatCard label="Minutes" value={String(summary.total_duration_minutes)} />
          <StatCard
            label="Completed"
            value={`${summary.exercises_completed}/${summary.exercises_total}`}
          />
          <StatCard label="Streak" value={`${summary.day_streak} day${summary.day_streak !== 1 ? 's' : ''}`} />
        </div>

        {/* Ratings breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4">
          <h2 className="text-sm font-medium text-gray-700 mb-3">
            How it went
          </h2>
          <div className="space-y-2">
            {ratings.step_forward > 0 && (
              <RatingRow color="bg-teal-400" label="Step forward" count={ratings.step_forward} />
            )}
            {ratings.steady > 0 && (
              <RatingRow color="bg-gray-400" label="Steady" count={ratings.steady} />
            )}
            {ratings.step_back > 0 && (
              <RatingRow color="bg-amber-400" label="Step back" count={ratings.step_back} />
            )}
            {ratings.skipped > 0 && (
              <RatingRow color="bg-gray-200" label="Skipped" count={ratings.skipped} />
            )}
          </div>
        </div>

        {/* Coaching suggestion */}
        {coaching_suggestion && (
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 mb-4">
            <p className="text-sm text-teal-900 leading-relaxed">
              {coaching_suggestion.text}
            </p>
          </div>
        )}

        {/* Reflection prompt */}
        {reflection_prompt && !reflectionSaved && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4">
            <p className="text-sm font-medium text-gray-700 mb-1">
              {reflection_prompt}
            </p>
            <p className="text-xs text-gray-400 mb-3">
              Optional — a moment to notice what you might forget later.
            </p>
            <textarea
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              placeholder="Felt more relaxed in the left hand. Maybe the new warm-up is helping..."
              rows={3}
              className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-primary-400 mb-2"
            />
            <button
              onClick={handleSaveReflection}
              disabled={!reflection.trim()}
              className="text-sm text-primary-600 font-medium hover:text-primary-700 disabled:text-gray-400"
            >
              Save reflection
            </button>
          </div>
        )}
        {reflectionSaved && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4">
            <p className="text-sm text-gray-500">Reflection saved.</p>
          </div>
        )}

        {/* Actions */}
        <Link
          href="/today"
          className="block w-full text-center py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors shadow-sm"
        >
          Done
        </Link>
      </div>
    </main>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 text-center">
      <p className="text-lg font-semibold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  )
}

function RatingRow({
  color,
  label,
  count,
}: {
  color: string
  label: string
  count: number
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
      <span className="text-sm text-gray-600 flex-1">{label}</span>
      <span className="text-sm text-gray-900 font-medium">{count}</span>
    </div>
  )
}
