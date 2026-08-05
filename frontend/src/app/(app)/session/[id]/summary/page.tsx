'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useApi } from '@/lib/useApi'
import {
  Button,
  Card,
  StatCard,
  TextArea,
  VoiceInput,
  appendTranscript,
} from '@/components/ui'
import { formatSessionDate } from '@/lib/dates'
import type { FinishResponse } from '@/lib/types'

// Token-driven CTA styles for navigation links (mirrors the Today retone).
const PRIMARY_LINK =
  'block w-full rounded-lg bg-primary px-4 py-3 text-center text-sm font-medium ' +
  'text-text-on-primary-action transition-colors hover:bg-primary-hover'
const SECONDARY_LINK =
  'block w-full py-2 text-center text-sm text-text-link transition-colors hover:text-text-primary'

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
        // fall through to API fallback
      }
    }

    // Fallback: reconstruct from the API (handles page refresh).
    // We can't get the full FinishResponse, but we can show the practice log.
    const loadFromApi = async () => {
      try {
        const log = await api.getPractice(logId)
        if (log.status !== 'completed') {
          router.replace(`/session/${logId}`)
          return
        }
        // Build a partial summary from the log data
        const allBlocks = log.section_logs.flatMap((sl) => sl.block_logs)
        const completed = allBlocks.filter((bl) => bl.completed)
        const sf = completed.filter((bl) => bl.rating === 1).length
        const st = completed.filter((bl) => bl.rating === 0).length
        const sb = completed.filter((bl) => bl.rating === -1).length
        const sk = allBlocks.length - completed.length

        setData({
          practice_log: log,
          summary: {
            total_duration_minutes: log.total_duration_minutes,
            exercises_completed: completed.length,
            exercises_total: allBlocks.length,
            day_streak: 0, // can't reconstruct from log alone
            ratings: { step_forward: sf, steady: st, step_back: sb, skipped: sk },
          },
          coaching_suggestion: null,
          reflection_prompt: log.reflection_prompt,
        })
      } catch {
        router.replace('/today')
      }
    }
    loadFromApi()
  }, [logId, router, api])

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

  const { practice_log, summary, coaching_suggestion, reflection_prompt } = data
  const { ratings } = summary

  const subtitle = [
    formatSessionDate(practice_log.practice_date),
    practice_log.session_name ?? practice_log.template_name,
    practice_log.instrument_name,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">
          Session complete
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-md">
        <StatCard label="Minutes" value={summary.total_duration_minutes} />
        <StatCard
          label="Completed"
          value={`${summary.exercises_completed}/${summary.exercises_total}`}
        />
        <StatCard
          label="Streak"
          value={`${summary.day_streak} day${summary.day_streak !== 1 ? 's' : ''}`}
        />
      </div>

      {/* Ratings breakdown */}
      <Card>
        <h2 className="mb-3 text-sm font-medium text-text-secondary">
          How it went
        </h2>
        <div className="space-y-2">
          {ratings.step_forward > 0 && (
            <RatingRow
              color="bg-rating-forward-border"
              label="Step forward"
              count={ratings.step_forward}
            />
          )}
          {ratings.steady > 0 && (
            <RatingRow
              color="bg-rating-steady-border"
              label="Steady"
              count={ratings.steady}
            />
          )}
          {ratings.step_back > 0 && (
            <RatingRow
              color="bg-rating-back-border"
              label="Step back"
              count={ratings.step_back}
            />
          )}
          {ratings.skipped > 0 && (
            <RatingRow
              color="bg-rating-unselected-border"
              label="Skipped"
              count={ratings.skipped}
            />
          )}
        </div>
      </Card>

      {/* Coaching suggestion */}
      {coaching_suggestion && (
        <Card variant="coaching">{coaching_suggestion.text}</Card>
      )}

      {/* Reflection prompt */}
      {reflection_prompt && !reflectionSaved && (
        <Card>
          <p className="text-sm font-medium text-text-primary">
            {reflection_prompt}
          </p>
          <p className="mb-3 mt-1 text-xs text-text-tertiary">
            Optional — a moment to notice what you might forget later.
          </p>
          <div className="mb-2 flex items-start gap-2">
            <TextArea
              variant="recessed"
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              placeholder="Felt more relaxed in the left hand. Maybe the new warm-up is helping..."
              rows={3}
              className="flex-1"
            />
            <VoiceInput
              onTranscript={(text) =>
                setReflection((prev) => appendTranscript(prev, text))
              }
              aria-label="Dictate your reflection"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSaveReflection}
            disabled={!reflection.trim()}
          >
            Save reflection
          </Button>
        </Card>
      )}
      {reflectionSaved && (
        <Card>
          <p className="text-sm text-text-secondary">Reflection saved.</p>
        </Card>
      )}

      {/* Actions */}
      <div className="space-y-1 pt-2">
        <Link href="/today" className={PRIMARY_LINK}>
          Done
        </Link>
        <Link href={`/session/${logId}`} className={SECONDARY_LINK}>
          Edit this session
        </Link>
      </div>
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
      <span className={`h-2.5 w-2.5 rounded-round ${color}`} />
      <span className="flex-1 text-sm text-text-secondary">{label}</span>
      <span className="text-sm font-medium text-text-primary">{count}</span>
    </div>
  )
}
