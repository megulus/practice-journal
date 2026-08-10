'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useApi } from '@/lib/useApi'
import { Button, Card } from '@/components/ui'
import { PracticeHeatmap } from './PracticeHeatmap'
import { localYear } from './heatmapGrid'
import { WeekComparison } from './WeekComparison'
import { RatingTrend } from './RatingTrend'
import type {
  ComparisonResponse,
  HeatmapResponse,
  RatingsResponse,
} from '@/lib/types'

const RATING_WEEKS = 4

interface InsightsData {
  heatmap: HeatmapResponse
  comparison: ComparisonResponse
  ratings: RatingsResponse
}

/**
 * Progress → Insights (spec §5.7): the practice calendar, this-week-vs-last
 * comparison, and rating trend for the selected instrument.
 *
 * The three endpoints are independent, so they load together and the panel
 * shows one loading/error state rather than three — partial charts would read
 * as missing data rather than a slow network.
 *
 * Not here yet: the pattern-level suggestion card spec §5.7 puts above both
 * sub-tabs. The rules engine computes that tier but no endpoint exposes it —
 * tracked as #253.
 */
export function InsightsPanel({ instrumentId }: { instrumentId: number | null }) {
  const api = useApi()
  const [data, setData] = useState<InsightsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Bumped whenever the instrument changes. An in-flight response whose
  // generation is stale is dropped instead of applied — otherwise switching
  // instruments mid-request lets the slower earlier response paint the
  // previous instrument's charts over the new one (and a stale rejection
  // replace an already-rendered panel with the error state). Same guard, and
  // same reason, as HistoryList.
  const generationRef = useRef(0)

  const load = useCallback(async () => {
    const generation = ++generationRef.current
    if (instrumentId === null) {
      setData(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [heatmap, comparison, ratings] = await Promise.all([
        // Ask for the browser's year rather than letting the endpoint default
        // to the server's UTC one — see localYear.
        api.getHeatmap(instrumentId, localYear()),
        api.getComparison(instrumentId),
        api.getRatings(instrumentId, RATING_WEEKS),
      ])
      if (generation !== generationRef.current) return
      setData({ heatmap, comparison, ratings })
    } catch (err) {
      if (generation !== generationRef.current) return
      setError(err instanceof Error ? err.message : 'Failed to load insights')
    } finally {
      if (generation === generationRef.current) setLoading(false)
    }
  }, [api, instrumentId])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return <p className="py-12 text-center text-sm text-text-secondary">Loading…</p>
  }

  if (error) {
    return (
      <div className="py-12 text-center">
        <p className="mb-3 text-sm text-danger-text" role="alert">
          {error}
        </p>
        <Button variant="ghost" size="sm" onClick={load}>
          Retry
        </Button>
      </div>
    )
  }

  if (!data) return null

  if (!hasAnyPractice(data)) return <EmptyState />

  return (
    <div className="space-y-4">
      <InsightCard title="Practice calendar">
        <PracticeHeatmap year={data.heatmap.year} days={data.heatmap.days} />
      </InsightCard>

      <InsightCard title="This week vs. last">
        <WeekComparison data={data.comparison} />
      </InsightCard>

      <InsightCard title="How it's going">
        <RatingTrend weeks={data.ratings.weeks} />
      </InsightCard>
    </div>
  )
}

function hasAnyPractice({ heatmap, comparison, ratings }: InsightsData): boolean {
  return (
    heatmap.days.some((d) => d.duration_minutes > 0) ||
    comparison.this_week.total_minutes > 0 ||
    comparison.last_week.total_minutes > 0 ||
    ratings.weeks.some((w) => w.total > 0)
  )
}

function InsightCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold text-text-primary">{title}</h2>
      {children}
    </Card>
  )
}

function EmptyState() {
  return (
    <Card className="text-center">
      <p className="mb-1 text-sm text-text-secondary">Nothing to chart yet.</p>
      <p className="mb-4 text-xs text-text-tertiary">
        Your practice calendar, weekly comparison and rating trend fill in once
        you finish a session on this instrument.
      </p>
      <Link
        href="/today"
        className="text-sm text-text-link transition-colors hover:text-text-primary"
      >
        Start practicing
      </Link>
    </Card>
  )
}
