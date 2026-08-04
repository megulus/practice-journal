'use client'

import { useCallback, useState } from 'react'
import { useApi } from '@/lib/useApi'
import { Card } from '@/components/ui'
import { groupBlockLogs } from '@/components/session'
import { formatHistoryDate } from '@/lib/dates'
import { cx } from '@/lib/cx'
import { ratingDisplay } from './ratingDisplay'
import type { BlockLog, HistoryItem, PracticeLog } from '@/lib/types'

/**
 * One row of the History list (spec §5.7). Collapsed it shows date, session
 * name, plan source, duration and exercise count; expanded it pulls the full
 * log and lists every exercise with its rating and notes.
 *
 * The detail is fetched lazily on first expand and kept afterwards — the list
 * endpoint only carries the collapsed fields.
 */
export function SessionHistoryCard({ item }: { item: HistoryItem }) {
  const api = useApi()
  const [expanded, setExpanded] = useState(false)
  const [detail, setDetail] = useState<PracticeLog | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadDetail = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setDetail(await api.getHistoryDetail(item.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session')
    } finally {
      setLoading(false)
    }
  }, [api, item.id])

  const handleToggle = () => {
    const next = !expanded
    setExpanded(next)
    if (next && !detail && !loading) loadDetail()
  }

  const detailId = `session-detail-${item.id}`
  const title = item.session_name ?? 'Freeform session'
  const source = item.is_freeform
    ? 'Off-plan · no template'
    : [item.template_name, item.rotation_label].filter(Boolean).join(' · ')

  return (
    <Card style={{ padding: 0 }} className="overflow-hidden">
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={expanded}
        aria-controls={expanded ? detailId : undefined}
        className={cx(
          'flex w-full items-start justify-between gap-md p-lg text-left transition-colors',
          'hover:bg-card-bg-inset',
          'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary',
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="text-xs text-text-secondary">
            {formatHistoryDate(item.practice_date)}
          </p>
          <h3 className="mt-0.5 truncate text-sm font-semibold text-text-primary">
            {title}
          </h3>
          {source && (
            <p className="mt-0.5 text-xs text-text-secondary">{source}</p>
          )}
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="text-sm font-semibold tabular-nums text-text-primary">
            {item.total_duration_minutes} min
          </p>
          <p className="mt-0.5 text-xs tabular-nums text-text-secondary">
            {item.exercise_count} exercise{item.exercise_count === 1 ? '' : 's'}
          </p>
          <span className="mt-0.5 block text-xs text-text-link">
            {expanded ? 'collapse' : 'expand'}
          </span>
        </div>
      </button>

      {expanded && (
        <div
          id={detailId}
          className="border-t border-border-subtle bg-card-bg-inset px-lg py-md"
          data-testid={detailId}
        >
          {loading && <p className="text-xs text-text-secondary">Loading…</p>}
          {error && (
            <p className="text-xs text-danger-text" role="alert">
              {error}
            </p>
          )}
          {detail && <SessionDetail log={detail} />}
        </div>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Expanded body
// ---------------------------------------------------------------------------

function SessionDetail({ log }: { log: PracticeLog }) {
  // Section boundaries aren't shown (the wireframe lists exercises flat), but
  // the per-section order is what defines the sequence, so walk them in order.
  const groups = log.section_logs.flatMap((sl) =>
    groupBlockLogs(sl.block_logs, null),
  )

  return (
    <div className="space-y-md">
      {groups.length === 0 ? (
        <p className="text-xs text-text-secondary">No exercises logged.</p>
      ) : (
        <ul className="space-y-2">
          {groups.map((group) =>
            group.type === 'standard' ? (
              <li key={`b-${group.blockLog.id}`}>
                <ExerciseRow blockLog={group.blockLog} />
              </li>
            ) : (
              <li key={`rep-${group.blockId}`}>
                {group.pieceLog ? (
                  <ExerciseRow
                    blockLog={group.pieceLog}
                    name={group.pieceName}
                  />
                ) : (
                  <p className="text-sm text-text-primary">{group.pieceName}</p>
                )}
                {group.spotLogs.length > 0 && (
                  <ul className="mt-1.5 space-y-1.5 border-l border-border-default pl-md">
                    {group.spotLogs.map((spot) => (
                      <li key={`s-${spot.id}`}>
                        <ExerciseRow
                          blockLog={spot}
                          name={spotName(spot, group.pieceName)}
                          muted
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ),
          )}
        </ul>
      )}

      {log.notes && <DetailNote label="Session notes" text={log.notes} />}
      {log.reflection_response && (
        <DetailNote
          label={log.reflection_prompt ?? 'Reflection'}
          text={log.reflection_response}
        />
      )}
    </div>
  )
}

function ExerciseRow({
  blockLog,
  name,
  muted = false,
}: {
  blockLog: BlockLog
  name?: string
  muted?: boolean
}) {
  const { label, dotClass } = ratingDisplay(blockLog)
  return (
    <div>
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className={cx('h-2 w-2 flex-shrink-0 rounded-round', dotClass)}
        />
        <span
          className={cx(
            'min-w-0 flex-1 truncate text-sm',
            muted ? 'text-text-secondary' : 'text-text-primary',
          )}
        >
          {name ?? blockLog.block_name}
        </span>
        <span className="flex-shrink-0 text-xs text-text-secondary">
          {label}
        </span>
      </div>
      {blockLog.notes && (
        <p className="ml-4 mt-0.5 text-xs italic text-text-secondary">
          {blockLog.notes}
        </p>
      )}
    </div>
  )
}

function DetailNote({ label, text }: { label: string; text: string }) {
  return (
    <div className="border-t border-border-subtle pt-md">
      <p className="text-xs font-medium text-text-tertiary">{label}</p>
      <p className="mt-0.5 text-sm italic text-text-secondary">{text}</p>
    </div>
  )
}

/**
 * Repertoire spot logs are named "Piece — Spot"; the row already sits under
 * its piece, so drop the prefix.
 *
 * Strips the group's actual piece name rather than splitting on the first
 * " — ", so a name that doesn't carry the expected prefix is left intact
 * instead of being chopped at an arbitrary separator. (A piece *title*
 * containing " — " still truncates, but that happens upstream in
 * `groupBlockLogs`, which derives the piece name the same way for the active
 * session — worth fixing there, not here.)
 */
function spotName(blockLog: BlockLog, pieceName: string): string {
  const prefix = `${pieceName} — `
  return blockLog.block_name.startsWith(prefix)
    ? blockLog.block_name.slice(prefix.length)
    : blockLog.block_name
}
