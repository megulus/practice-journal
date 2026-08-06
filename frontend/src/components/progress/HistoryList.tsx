'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useApi } from '@/lib/useApi'
import { Button, Card, Pill } from '@/components/ui'
import { SessionHistoryCard } from './SessionHistoryCard'
import type { HistoryItem, HistoryPeriod } from '@/lib/types'

const PERIODS: { value: HistoryPeriod; label: string }[] = [
  { value: 'all', label: 'All sessions' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
]

/**
 * Progress → History (spec §5.7): a reverse-chronological list of completed
 * sessions for the selected instrument, filtered by time range.
 *
 * Paging is the API's opaque cursor rather than an offset, so "Load more"
 * appends and the filter pills reset the list.
 */
export function HistoryList({ instrumentId }: { instrumentId: number | null }) {
  const api = useApi()
  const [period, setPeriod] = useState<HistoryPeriod>('all')
  const [items, setItems] = useState<HistoryItem[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // A failed page-2 fetch must not take the already-loaded list down with it,
  // so paging errors are tracked separately from first-page errors.
  const [moreError, setMoreError] = useState<string | null>(null)

  // Bumped whenever the query (instrument or period) changes. An in-flight
  // response whose generation is stale is dropped instead of applied —
  // otherwise switching instruments mid-request appends the previous
  // instrument's sessions to the new list and installs its cursor.
  const generationRef = useRef(0)

  const load = useCallback(async () => {
    const generation = ++generationRef.current
    setLoading(true)
    setError(null)
    setMoreError(null)
    try {
      const res = await api.getHistory({
        instrumentId: instrumentId ?? undefined,
        period,
      })
      if (generation !== generationRef.current) return
      setItems(res.items)
      setCursor(res.next_cursor)
    } catch (err) {
      if (generation !== generationRef.current) return
      setError(err instanceof Error ? err.message : 'Failed to load history')
    } finally {
      if (generation === generationRef.current) setLoading(false)
    }
  }, [api, instrumentId, period])

  useEffect(() => {
    load()
  }, [load])

  const loadMore = async () => {
    if (!cursor || loadingMore) return
    const generation = generationRef.current
    setLoadingMore(true)
    setMoreError(null)
    try {
      const res = await api.getHistory({
        instrumentId: instrumentId ?? undefined,
        period,
        cursor,
      })
      if (generation !== generationRef.current) return
      setItems((prev) => [...prev, ...res.items])
      setCursor(res.next_cursor)
    } catch (err) {
      if (generation !== generationRef.current) return
      setMoreError(err instanceof Error ? err.message : 'Failed to load more')
    } finally {
      // Unconditional, unlike the guards above: `loadingMore` describes the
      // button, not the query, and nothing else clears it. Gating it on the
      // generation would leave a superseded page fetch with the button stuck
      // disabled at "Loading…" forever, since `loadMore` early-returns while
      // it's set. Two page fetches can't overlap — the button is disabled
      // while one is in flight, and during a `load` the list isn't rendered.
      setLoadingMore(false)
    }
  }

  return (
    <div className="space-y-4">
      <div role="group" aria-label="Time range" className="flex gap-2">
        {PERIODS.map((p) => (
          <Pill
            key={p.value}
            variant="instrument"
            active={p.value === period}
            onClick={() => setPeriod(p.value)}
            className="whitespace-nowrap"
          >
            {p.label}
          </Pill>
        ))}
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-text-secondary">Loading…</p>
      ) : error ? (
        <div className="py-12 text-center">
          <p className="mb-3 text-sm text-danger-text" role="alert">
            {error}
          </p>
          <Button variant="ghost" size="sm" onClick={load}>
            Retry
          </Button>
        </div>
      ) : items.length === 0 ? (
        <EmptyState period={period} />
      ) : (
        <>
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id}>
                <SessionHistoryCard item={item} />
              </li>
            ))}
          </ul>
          {cursor && (
            <div className="text-center">
              {moreError && (
                <p className="mb-2 text-xs text-danger-text" role="alert">
                  {moreError}
                </p>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore
                  ? 'Loading…'
                  : moreError
                    ? 'Try again'
                    : 'Load more'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function EmptyState({ period }: { period: HistoryPeriod }) {
  if (period !== 'all') {
    return (
      <Card className="text-center">
        <p className="text-sm text-text-secondary">
          No sessions in this time range.
        </p>
      </Card>
    )
  }
  return (
    <Card className="text-center">
      <p className="mb-1 text-sm text-text-secondary">No sessions yet.</p>
      <p className="mb-4 text-xs text-text-tertiary">
        Finished sessions show up here, newest first.
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
