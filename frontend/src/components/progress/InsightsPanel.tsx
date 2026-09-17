'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useApi } from '@/lib/useApi'
import { formatSessionDate } from '@/lib/dates'
import { Button, Card } from '@/components/ui'
import { PracticeHeatmap } from './PracticeHeatmap'
import { localYear } from './heatmapGrid'
import { WeekComparison } from './WeekComparison'
import { RatingTrend } from './RatingTrend'
import type {
  ComparisonResponse,
  HeatmapResponse,
  RatingsResponse,
  UserSettings,
} from '@/lib/types'

const RATING_WEEKS = 4

interface InsightsData {
  heatmap: HeatmapResponse
  comparison: ComparisonResponse
  ratings: RatingsResponse
  settings: UserSettings
}

/**
 * Progress → Insights (spec §5.7): the practice calendar, this-week-vs-last
 * comparison, and rating trend for the selected instrument.
 *
 * The endpoints are independent, so they load together and the panel shows one
 * loading/error state rather than three — partial charts would read as missing
 * data rather than a slow network. Settings rides along in the same
 * `Promise.all`: the heatmap's week boundary comes from `week_starts_on`
 * (#300), and fetching it separately would either flash a Monday-first grid
 * that then re-lays-out, or add a second spinner to the same card.
 *
 * Not here yet: the pattern-level suggestion card spec §5.7 puts above both
 * sub-tabs. The rules engine computes that tier but no endpoint exposes it —
 * tracked as #253.
 *
 * `lastPracticedAt` is the selected instrument's `last_practiced_at`, passed
 * down from the Progress page (which already holds the instruments array)
 * rather than fetched here. It is the one signal on this screen that isn't
 * window-scoped — see the render gate below.
 */
export function InsightsPanel({
  instrumentId,
  lastPracticedAt,
}: {
  instrumentId: number | null
  lastPracticedAt: string | null
}) {
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
      const [heatmap, comparison, ratings, settings] = await Promise.all([
        // Ask for the browser's year rather than letting the endpoint default
        // to the server's UTC one — see localYear.
        api.getHeatmap(instrumentId, localYear()),
        api.getComparison(instrumentId),
        api.getRatings(instrumentId, RATING_WEEKS),
        api.getSettings(),
      ])
      if (generation !== generationRef.current) return
      setData({ heatmap, comparison, ratings, settings })
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

  // Two different emptinesses, and the old gate conflated them (#287).
  // `hasWindowData` asks whether these three charts have anything to draw;
  // every signal it reads is recency-scoped (the calendar year, this week and
  // last, the last four weeks), so all three go quiet together for anyone
  // returning from a break — and ORing them told a user with months of
  // history that they had none. `lastPracticedAt` is the un-windowed
  // counterpart: the max `practice_date` over the instrument's completed
  // sessions, with no date filter at all.
  //
  // So only a user with neither gets a first-run state. A returning user gets
  // the charts, gap and all — an empty January under a dense December is a
  // truer picture than a placeholder that denies the December happened — with
  // a line above them that names the gap instead of the user.
  const charted = hasWindowData(data)

  if (!charted && lastPracticedAt === null) return <FirstRunState />

  return (
    <div className="space-y-4">
      {!charted && lastPracticedAt !== null && (
        <LapsedNote lastPracticedAt={lastPracticedAt} />
      )}

      <InsightCard title="Practice calendar">
        <PracticeHeatmap
          year={data.heatmap.year}
          days={data.heatmap.days}
          weekStartsOn={data.settings.week_starts_on}
        />
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

/**
 * Whether any of the three charts has data *in the window it covers* —
 * deliberately not "has this user ever practised", which is what the name
 * `hasAnyPractice` used to imply and the reason #287 happened.
 */
function hasWindowData({ heatmap, comparison, ratings }: InsightsData): boolean {
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

/**
 * No sessions on this instrument, ever. Per #310's pattern an empty state
 * should name what will appear and why it's worth having, then point at the
 * single action that fills it — rather than only reporting an absence.
 */
function FirstRunState() {
  return (
    <Card className="text-center">
      <p className="mb-1 text-sm text-text-secondary">
        Your first session starts the picture.
      </p>
      <p className="mb-4 text-xs text-text-tertiary">
        The practice calendar fills a square for every day you play, and the
        rating trend follows which way your work is heading. One session is
        enough to begin.
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

/**
 * History exists but falls outside every chart's window. Sits above the
 * charts rather than replacing them, and says why they read empty — spec
 * §5.2's framing applies here too: an observation about the window, not a
 * verdict on the user.
 */
function LapsedNote({ lastPracticedAt }: { lastPracticedAt: string }) {
  return (
    <Card>
      <p className="mb-1 text-sm text-text-secondary">
        Nothing in the last few weeks — the practice before that is still here.
      </p>
      <p className="text-xs text-text-tertiary">
        Last session on this instrument: {formatSessionDate(lastPracticedAt)}.
        These charts cover this year and the last few weeks, so they&rsquo;ll
        start filling in again with your next session.
      </p>
    </Card>
  )
}
