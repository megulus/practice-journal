'use client'

import { useCallback, useEffect, useState } from 'react'
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

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.getHistory({
        instrumentId: instrumentId ?? undefined,
        period,
      })
      setItems(res.items)
      setCursor(res.next_cursor)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history')
    } finally {
      setLoading(false)
    }
  }, [api, instrumentId, period])

  useEffect(() => {
    load()
  }, [load])

  const loadMore = async () => {
    if (!cursor || loadingMore) return
    setLoadingMore(true)
    try {
      const res = await api.getHistory({
        instrumentId: instrumentId ?? undefined,
        period,
        cursor,
      })
      setItems((prev) => [...prev, ...res.items])
      setCursor(res.next_cursor)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more')
    } finally {
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
              <Button
                variant="ghost"
                size="sm"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading…' : 'Load more'}
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
