'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useApi } from '@/lib/useApi'
import { Button, Card } from '@/components/ui'
import { PracticeHeatmap } from './PracticeHeatmap'
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

  const load = useCallback(async () => {
    if (instrumentId === null) {
      setData(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [heatmap, comparison, ratings] = await Promise.all([
        api.getHeatmap(instrumentId),
        api.getComparison(instrumentId),
        api.getRatings(instrumentId, RATING_WEEKS),
      ])
      setData({ heatmap, comparison, ratings })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load insights')
    } finally {
      setLoading(false)
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
