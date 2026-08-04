'use client'

import { useCallback, useEffect, useId, useState } from 'react'
import { ChevronDown, Pencil, Trash2 } from 'lucide-react'
import { useApi } from '@/lib/useApi'
import { Button, Card, Menu, TextInput } from '@/components/ui'
import ConfirmDialog from '@/components/ConfirmDialog'
import { formatRelativeDay } from '@/lib/dates'
import type { Piece, Spot } from '@/lib/types'
import { SpotEditForm, type SpotFormValues } from './SpotEditForm'
import { SpotHistorySheet } from './SpotHistorySheet'
import { SpotRow } from './SpotRow'

/**
 * A piece in the repertoire library. Collapsed it's a name, an optional
 * composer/source, and a practice summary; expanded it loads the piece's
 * spots (retired ones included, grouped separately) and exposes the per-spot
 * management affordances.
 *
 * Spots load lazily on first expand: a library can run to dozens of pieces,
 * and fetching every spot list up front would be a lot of requests for
 * something the user mostly scrolls past.
 *
 * Failures are reported inside the card rather than handed to the list. A
 * retire that fails changes nothing on screen, so a banner at the top of a
 * long library would leave the user tapping a control that looks dead — the
 * message has to be where the action was.
 */
export function PieceCard({
  piece,
  onChange,
}: {
  piece: Piece
  onChange: () => void
}) {
  const api = useApi()
  const spotsId = useId()
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [spots, setSpots] = useState<Spot[] | null>(null)
  const [editingPiece, setEditingPiece] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [addingSpot, setAddingSpot] = useState(false)
  const [historySpot, setHistorySpot] = useState<Spot | null>(null)

  const loadSpots = useCallback(async () => {
    try {
      const detail = await api.getPiece(piece.id, { includeRetiredSpots: true })
      setSpots(detail.spots)
      setError(null)
    } catch {
      setError("Couldn't load this piece's spots. Please try again.")
    }
  }, [api, piece.id])

  useEffect(() => {
    if (expanded && spots === null) loadSpots()
  }, [expanded, spots, loadSpots])

  /**
   * Run a spot mutation, then resync. Anything that changes a spot also moves
   * the piece's counters, so the parent list refetches alongside the spots.
   * Returns whether it succeeded, so an open form can stay open on failure
   * rather than discarding what the user typed.
   */
  const mutateSpot = async (
    failureMessage: string,
    action: () => Promise<unknown>,
  ): Promise<boolean> => {
    try {
      await action()
    } catch {
      setError(failureMessage)
      return false
    }
    await loadSpots()
    onChange()
    return true
  }

  const savePiece = async (name: string, composer: string) => {
    try {
      await api.updatePiece(piece.id, { name, composer_or_source: composer })
      setEditingPiece(false)
      setError(null)
      onChange()
    } catch {
      setError("Couldn't save the piece. Please try again.")
    }
  }

  const deletePiece = async () => {
    setConfirmingDelete(false)
    try {
      await api.deletePiece(piece.id)
      onChange()
    } catch {
      setError("Couldn't delete the piece. Please try again.")
    }
  }

  const renderSpot = (spot: Spot) => (
    <SpotRow
      key={spot.id}
      spot={spot}
      onEdit={(values: SpotFormValues) =>
        mutateSpot("Couldn't save the spot. Please try again.", () =>
          api.updateSpot(spot.id, {
            name: values.name,
            location: values.location,
          }),
        )
      }
      onRetire={() =>
        mutateSpot("Couldn't retire the spot. Please try again.", () =>
          api.retireSpot(spot.id),
        )
      }
      onUnretire={() =>
        mutateSpot("Couldn't bring the spot back. Please try again.", () =>
          api.unretireSpot(spot.id),
        )
      }
      onDelete={() =>
        mutateSpot("Couldn't delete the spot. Please try again.", () =>
          api.deleteSpot(spot.id),
        )
      }
      onViewHistory={() => setHistorySpot(spot)}
    />
  )

  const activeSpots = spots?.filter((s) => s.retired_at === null) ?? []
  const retiredSpots = spots?.filter((s) => s.retired_at !== null) ?? []

  const summary = [
    `${piece.session_count} session${piece.session_count !== 1 ? 's' : ''}`,
    piece.last_practiced_at
      ? `last practiced ${formatRelativeDay(piece.last_practiced_at)}`
      : 'never practiced',
  ].join(' · ')

  return (
    <Card>
      {editingPiece ? (
        <PieceEditForm
          initialName={piece.name}
          initialComposer={piece.composer_or_source ?? ''}
          onSubmit={savePiece}
          onCancel={() => setEditingPiece(false)}
        />
      ) : (
        <div className="flex items-start gap-sm">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-controls={spotsId}
            className="flex min-w-0 flex-1 items-start gap-sm text-left"
          >
            <ChevronDown
              size={16}
              strokeWidth={1.5}
              aria-hidden
              className={`mt-[3px] flex-shrink-0 text-text-tertiary transition-transform ${
                expanded ? '' : '-rotate-90'
              }`}
            />
            <span className="min-w-0">
              <span className="block truncate font-medium text-text-primary">
                {piece.name}
              </span>
              {piece.composer_or_source && (
                <span className="block truncate text-xs text-text-secondary">
                  {piece.composer_or_source}
                </span>
              )}
              <span className="block text-xs text-text-tertiary">{summary}</span>
            </span>
          </button>

          <Menu
            triggerLabel={`${piece.name} actions`}
            items={[
              {
                label: 'Rename piece',
                icon: <Pencil size={14} />,
                onSelect: () => setEditingPiece(true),
              },
              {
                label: 'Delete piece',
                icon: <Trash2 size={14} />,
                destructive: true,
                onSelect: () => setConfirmingDelete(true),
              },
            ]}
          />
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="mt-md rounded-lg bg-card-bg-inset px-3 py-2 text-sm text-danger-text"
        >
          {error}
        </p>
      )}

      {expanded && (
        <div id={spotsId} className="mt-md border-t border-border-subtle pt-md">
          {spots === null ? (
            <p className="text-sm text-text-secondary">Loading spots…</p>
          ) : (
            <>
              {spots.length === 0 && (
                <p className="text-sm text-text-secondary">
                  No spots yet. Add the passages you work on and they&rsquo;ll
                  be there when this piece comes up in a session.
                </p>
              )}

              {activeSpots.length > 0 && (
                <ul className="divide-y divide-border-subtle">
                  {activeSpots.map(renderSpot)}
                </ul>
              )}

              {retiredSpots.length > 0 && (
                <>
                  <p className="mb-xs mt-md text-xs font-medium uppercase tracking-wide text-text-tertiary">
                    Retired
                  </p>
                  <ul className="divide-y divide-border-subtle">
                    {retiredSpots.map(renderSpot)}
                  </ul>
                </>
              )}

              {addingSpot ? (
                <div className="mt-md">
                  <SpotEditForm
                    submitLabel="Add spot"
                    onSubmit={async (values) => {
                      const ok = await mutateSpot(
                        "Couldn't add the spot. Please try again.",
                        () =>
                          api.createSpot(piece.id, {
                            name: values.name,
                            location: values.location || undefined,
                          }),
                      )
                      if (ok) setAddingSpot(false)
                    }}
                    onCancel={() => setAddingSpot(false)}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingSpot(true)}
                  className="mt-md text-sm text-text-link transition-colors hover:text-text-primary"
                >
                  + Add spot
                </button>
              )}
            </>
          )}
        </div>
      )}

      {confirmingDelete && (
        <ConfirmDialog
          title={`Delete ${piece.name}?`}
          message={`This removes ${piece.name} and its spots from your repertoire. Past sessions keep their entries, but this piece's history won't be reachable.`}
          confirmLabel="Delete"
          confirmVariant="danger"
          onConfirm={deletePiece}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}

      {historySpot && (
        <SpotHistorySheet
          spot={historySpot}
          onClose={() => setHistorySpot(null)}
        />
      )}
    </Card>
  )
}

/** Inline name + composer editor for a piece, shown in place of its header. */
function PieceEditForm({
  initialName,
  initialComposer,
  onSubmit,
  onCancel,
}: {
  initialName: string
  initialComposer: string
  onSubmit: (name: string, composer: string) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(initialName)
  const [composer, setComposer] = useState(initialComposer)
  const [busy, setBusy] = useState(false)

  return (
    <form
      className="space-y-md"
      onSubmit={async (e) => {
        e.preventDefault()
        const trimmed = name.trim()
        if (!trimmed || busy) return
        setBusy(true)
        try {
          await onSubmit(trimmed, composer.trim())
        } finally {
          setBusy(false)
        }
      }}
    >
      <TextInput
        value={name}
        onChange={(e) => setName(e.target.value)}
        aria-label="Piece name"
        placeholder="Piece name"
        autoFocus
      />
      <TextInput
        value={composer}
        onChange={(e) => setComposer(e.target.value)}
        aria-label="Composer or source"
        placeholder="Composer or source (optional)"
      />
      <div className="flex gap-sm">
        <Button type="submit" size="sm" disabled={busy || !name.trim()}>
          Save
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
