'use client'

import { useEffect, useState } from 'react'
import { Button, Sheet } from '@/components/ui'
import { useApi } from '@/lib/useApi'
import { formatSessionDate } from '@/lib/dates'
import type { Rating, Spot, SpotHistory } from '@/lib/types'

const RATING_LABELS: Record<string, { label: string; dot: string }> = {
  '1': { label: 'Step forward', dot: 'bg-rating-forward-border' },
  '0': { label: 'Steady', dot: 'bg-rating-steady-border' },
  '-1': { label: 'Step back', dot: 'bg-rating-back-border' },
  skipped: { label: 'Skipped', dot: 'bg-rating-unselected-border' },
}

function ratingKey(rating: Rating | null): string {
  return rating === null ? 'skipped' : String(rating)
}

/**
 * Per-spot practice history (`GET /api/spots/{id}/history`): a rating-trend
 * tally over all logged sessions, then the sessions themselves newest-first
 * with whatever note was taken at the time.
 */
export function SpotHistorySheet({
  spot,
  onClose,
}: {
  spot: Spot
  onClose: () => void
}) {
  const api = useApi()
  const [history, setHistory] = useState<SpotHistory | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    api
      .getSpotHistory(spot.id)
      .then((data) => {
        if (!cancelled) setHistory(data)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [api, spot.id])

  const trend = history?.rating_trend

  return (
    <Sheet
      onClose={onClose}
      aria-labelledby="spot-history-title"
      className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-2xl bg-card-bg shadow-xl"
    >
      <div className="flex items-start justify-between gap-md border-b border-border-default px-lg pb-md pt-lg">
        <div className="min-w-0">
          <h2
            id="spot-history-title"
            className="truncate font-semibold text-text-primary"
          >
            {spot.name}
          </h2>
          {spot.location && (
            <p className="truncate text-xs text-text-secondary">
              {spot.location}
            </p>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Done
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-lg py-md">
        {error && (
          <p role="alert" className="text-sm text-danger-text">
            Couldn&rsquo;t load this spot&rsquo;s history.
          </p>
        )}

        {!error && history === null && (
          <p className="text-sm text-text-secondary">Loading…</p>
        )}

        {history !== null && history.logs.length === 0 && (
          <p className="text-sm text-text-secondary">
            No practice logged for this spot yet.
          </p>
        )}

        {history !== null && history.logs.length > 0 && trend && (
          <>
            <ul aria-label="Rating trend" className="mb-lg space-y-sm">
              {(
                [
                  ['1', trend.step_forward],
                  ['0', trend.steady],
                  ['-1', trend.step_back],
                  ['skipped', trend.skipped],
                ] as const
              )
                .filter(([, count]) => count > 0)
                .map(([key, count]) => (
                  <li key={key} className="flex items-center gap-md">
                    <span
                      aria-hidden
                      className={`h-2 w-2 flex-shrink-0 rounded-round ${RATING_LABELS[key].dot}`}
                    />
                    <span className="flex-1 text-sm text-text-secondary">
                      {RATING_LABELS[key].label}
                    </span>
                    <span className="text-sm text-text-primary">{count}</span>
                  </li>
                ))}
            </ul>

            <ul
              aria-label="Logged sessions"
              className="divide-y divide-border-subtle"
            >
              {history.logs.map((entry) => {
                const rating = RATING_LABELS[ratingKey(entry.rating)]
                return (
                  <li key={entry.block_log_id} className="py-md">
                    <div className="flex items-center gap-md">
                      <span
                        aria-hidden
                        className={`h-2 w-2 flex-shrink-0 rounded-round ${rating.dot}`}
                      />
                      <span className="flex-1 text-sm text-text-primary">
                        {formatSessionDate(entry.practice_date)}
                      </span>
                      <span className="text-xs text-text-tertiary">
                        {rating.label}
                      </span>
                    </div>
                    {entry.notes && (
                      <p className="mt-xs pl-[18px] text-xs text-text-secondary">
                        {entry.notes}
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>
    </Sheet>
  )
}
