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
  WeekStart,
} from '@/lib/types'

const RATING_WEEKS = 4

/** What the `user_settings` column defaults to, and what the grid falls back on. */
const DEFAULT_WEEK_START: WeekStart = 'monday'

interface InsightsData {
  heatmap: HeatmapResponse
  comparison: ComparisonResponse
  ratings: RatingsResponse
  /** Only the one field the grid needs — see the fallback in `load`. */
  weekStartsOn: WeekStart
}

/**
 * Progress → Insights (spec §5.7): the practice calendar, this-week-vs-last
 * comparison, and rating trend for the selected instrument.
 *
 * The three chart endpoints are independent, so they load together and the
 * panel shows one loading/error state rather than three — partial charts would
 * read as missing data rather than a slow network.
 *
 * Settings rides along in the same `Promise.all` because the heatmap's week
 * boundary comes from `week_starts_on` (#300) and a separate fetch would
 * either flash a Monday-first grid that then re-lays-out or add a second
 * spinner to one card — but it is *not* allowed to fail the panel with them.
 * It picks the grid's first column; the charts are the panel.
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
      const [heatmap, comparison, ratings, weekStartsOn] = await Promise.all([
        // Ask for the browser's year rather than letting the endpoint default
        // to the server's UTC one — see localYear.
        api.getHeatmap(instrumentId, localYear()),
        api.getComparison(instrumentId),
        api.getRatings(instrumentId, RATING_WEEKS),
        // Caught on its own: a settings outage should cost the user their
        // first-column preference, not all three charts. Before #300 this
        // panel never fetched settings, so an un-caught promise here would
        // hand /api/settings the power to blank a screen it previously
        // couldn't reach. The fallback is the same default the column has.
        api
          .getSettings()
          .then((s) => s.week_starts_on)
          .catch(() => DEFAULT_WEEK_START),
      ])
      if (generation !== generationRef.current) return
      setData({ heatmap, comparison, ratings, weekStartsOn })
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
        <QuietWindowNote
          lastPracticedAt={lastPracticedAt}
          chartedYear={data.heatmap.year}
        />
      )}

      <InsightCard title="Practice calendar">
        <PracticeHeatmap
          year={data.heatmap.year}
          days={data.heatmap.days}
          weekStartsOn={data.weekStartsOn}
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
 * Why the three charts are empty for a user who does have history.
 *
 * There are exactly two ways to get here, and they need different sentences —
 * the first draft of this note assumed only the second and could contradict
 * itself out loud. The widest of the three windows is the heatmap's calendar
 * year, so:
 *
 * - **Last session outside the charted year** — every window genuinely
 *   predates the charts. A real gap, of at least "since January" and possibly
 *   years; the note must not put a length on it, because `!charted` does not
 *   tell us one.
 * - **Last session inside the charted year** — the widest window *does* cover
 *   it and the charts still drew nothing, which can only mean that session
 *   logged no minutes and no ratings (`hasWindowData` tests `> 0`, while
 *   `last_practiced_at` is a plain `max(practice_date)` over completed logs —
 *   reachable via a quick-added section, which is created with
 *   `actual_duration_minutes=0`). Saying "nothing in the last few weeks" over
 *   a session dated today is the same denial #287 is about, pointed the other
 *   way.
 *
 * Either way the last-session date is the acknowledgement, and spec §5.2's
 * framing holds: an observation about the window, never a verdict on the user.
 */
function QuietWindowNote({
  lastPracticedAt,
  chartedYear,
}: {
  lastPracticedAt: string
  chartedYear: number
}) {
  const lastYear = Number(lastPracticedAt.slice(0, 4))
  const withinChartedYear = Number.isFinite(lastYear) && lastYear === chartedYear

  return (
    <Card>
      <p className="mb-1 text-sm text-text-secondary">
        {withinChartedYear
          ? 'Your last session didn\u2019t record any time or ratings.'
          : 'These charts don\u2019t reach back as far as your last session.'}
      </p>
      <p className="text-xs text-text-tertiary">
        Last session on this instrument: {formatSessionDate(lastPracticedAt)}.
        {withinChartedYear
          ? ' The calendar shades each day by how long you played and the trend follows your ratings, so a session with neither leaves them empty.'
          : ` The practice calendar covers ${chartedYear} and the two charts below it the last few weeks, so they\u2019ll start filling in again with your next session.`}
      </p>
    </Card>
  )
}
