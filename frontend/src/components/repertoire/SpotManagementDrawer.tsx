'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react'
import { useApi } from '@/lib/useApi'
import { formatRelativeDay } from '@/lib/dates'
import type { DefaultSpot, Spot } from '@/lib/types'
import { Button, Menu, Sheet } from '@/components/ui'
import { SearchCreateInput } from './SearchCreateInput'
import { SpotEditForm } from './SpotEditForm'

/** Which of the drawer's mutually exclusive views is on screen. */
type View = 'list' | 'search' | 'create'

const norm = (s: string) => s.trim().toLowerCase()

/**
 * Spot management for one repertoire block in the template editor: a bottom
 * sheet over the section editor showing the block's default spot list, with a
 * search-doubles-as-create flow for adding more.
 *
 * A drawer rather than inline expansion (repertoire doc, "Why a drawer, not
 * inline expansion"): the editor is a setup surface visited rarely, and keeping
 * the section list compact matters more than avoiding a context switch.
 *
 * The default spot list is owned by the caller (it comes off the template) and
 * refreshed through `onChange`; the piece's full spot list — including retired
 * spots, which the search can surface — is loaded here.
 */
export function SpotManagementDrawer({
  blockId,
  pieceId,
  pieceName,
  defaultSpots,
  onChange,
  onClose,
}: {
  blockId: number
  pieceId: number
  pieceName: string
  /** The block's current defaults, in order. */
  defaultSpots: DefaultSpot[]
  /** Reload the template so the caller's `defaultSpots` catch up. */
  onChange: () => Promise<void>
  onClose: () => void
}) {
  const api = useApi()
  const [spots, setSpots] = useState<Spot[] | null>(null)
  const [view, setView] = useState<View>('list')
  const [query, setQuery] = useState('')
  const [confirming, setConfirming] = useState<Spot | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadPiece = useCallback(async () => {
    // Retired spots are needed even though they're not offered by default —
    // the search surfaces them so they can be brought back.
    const detail = await api.getPiece(pieceId, { includeRetiredSpots: true })
    setSpots(detail.spots)
  }, [api, pieceId])

  useEffect(() => {
    loadPiece().catch(() =>
      setError("Couldn't load this piece's spots. Please try again."),
    )
  }, [loadPiece])

  /** Runs a mutation, surfacing failures in the drawer instead of throwing. */
  const run = async (fn: () => Promise<void>) => {
    if (busy) return false
    setBusy(true)
    try {
      await fn()
      setError(null)
      return true
    } catch {
      setError("That didn't save. Please try again.")
      return false
    } finally {
      setBusy(false)
    }
  }

  const backToList = () => {
    setView('list')
    setQuery('')
  }

  const addToDefaults = (spot: Spot) =>
    run(async () => {
      await api.addDefaultSpot(blockId, spot.id)
      await onChange()
      backToList()
    })

  const bringBack = (spot: Spot) =>
    run(async () => {
      // Un-retire first: a retired spot in a template's defaults would be
      // filtered right back out of the session it's meant to seed.
      await api.unretireSpot(spot.id)
      await api.addDefaultSpot(blockId, spot.id)
      await loadPiece()
      await onChange()
      setConfirming(null)
      backToList()
    })

  const createSpot = async (values: { name: string; location: string }) => {
    await run(async () => {
      const spot = await api.createSpot(pieceId, {
        name: values.name,
        location: values.location || undefined,
      })
      await api.addDefaultSpot(blockId, spot.id)
      await loadPiece()
      await onChange()
      backToList()
    })
  }

  const removeFromDefaults = (spotId: number) =>
    run(async () => {
      await api.removeDefaultSpot(blockId, spotId)
      await onChange()
    })

  const moveDefault = (spotId: number, direction: 'up' | 'down') => {
    const ids = defaultSpots.map((s) => s.id)
    const idx = ids.indexOf(spotId)
    const swap = direction === 'up' ? idx - 1 : idx + 1
    if (idx < 0 || swap < 0 || swap >= ids.length) return
    ;[ids[idx], ids[swap]] = [ids[swap], ids[idx]]
    return run(async () => {
      await api.reorderDefaultSpots(blockId, ids)
      await onChange()
    })
  }

  // -------------------------------------------------------------------
  // Search derivations
  // -------------------------------------------------------------------
  const defaultIds = useMemo(
    () => new Set(defaultSpots.map((s) => s.id)),
    [defaultSpots],
  )

  const { activeMatches, retiredMatches, exactMatch } = useMemo(() => {
    const all = spots ?? []
    const q = norm(query)
    // Already-default spots are out of the running, but they still block the
    // create link — otherwise a duplicate is one tap away.
    const candidates = all.filter(
      (s) => !defaultIds.has(s.id) && (!q || norm(s.name).includes(q)),
    )
    return {
      activeMatches: candidates.filter((s) => s.retired_at === null),
      retiredMatches: candidates.filter((s) => s.retired_at !== null),
      exactMatch: all.some((s) => norm(s.name) === q),
    }
  }, [spots, query, defaultIds])

  const trimmedQuery = query.trim()
  const showCreate = trimmedQuery.length > 0 && !exactMatch

  return (
    <Sheet
      onClose={onClose}
      aria-labelledby="spot-drawer-title"
      className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-2xl bg-card-bg shadow-xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
        <h2
          id="spot-drawer-title"
          className="min-w-0 truncate text-lg font-semibold text-text-primary"
        >
          {pieceName}
        </h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Done
        </Button>
      </div>

      {error && (
        <p
          role="alert"
          className="mx-4 mb-2 rounded-lg bg-card-bg-inset px-3 py-2 text-sm text-danger-text"
        >
          {error}
        </p>
      )}

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {confirming ? (
          <RetiredSpotConfirmPanel
            spot={confirming}
            busy={busy}
            onCancel={() => setConfirming(null)}
            onConfirm={() => bringBack(confirming)}
          />
        ) : view === 'create' ? (
          <div>
            <div className="flex items-center justify-between pb-2">
              <h3 className="text-sm font-medium text-text-primary">New spot</h3>
              <Button variant="ghost" size="sm" onClick={() => setView('search')}>
                Cancel
              </Button>
            </div>
            {/* "Create", not "Add to defaults": in the editor, creating a spot
                and adding it to this block's defaults are the same action. */}
            <SpotEditForm
              initialName={trimmedQuery}
              submitLabel="Create"
              onSubmit={createSpot}
              onCancel={() => setView('search')}
            />
          </div>
        ) : view === 'search' ? (
          <div className="space-y-3">
            <SearchCreateInput
              value={query}
              onChange={setQuery}
              label="Search spots"
              placeholder="Search or add a spot…"
              autoFocus
            />
            <SpotSearchResults
              active={activeMatches}
              retired={retiredMatches}
              loading={spots === null}
              busy={busy}
              onAdd={addToDefaults}
              onPickRetired={setConfirming}
            />
            {showCreate ? (
              <button
                type="button"
                onClick={() => setView('create')}
                className="flex w-full items-center gap-1 rounded-lg px-2 py-2 text-left text-sm text-text-link hover:bg-card-bg-inset"
              >
                <Plus size={14} aria-hidden />
                Create &ldquo;{trimmedQuery}&rdquo;
              </button>
            ) : (
              <Button variant="ghost" size="sm" onClick={backToList}>
                Cancel
              </Button>
            )}
          </div>
        ) : (
          <div>
            <h3 className="pb-1 text-xs uppercase tracking-wide text-text-tertiary">
              Default spots
            </h3>
            {defaultSpots.length === 0 ? (
              <p className="py-3 text-sm italic text-text-tertiary">
                No default spots yet. Spots you add here are pre-selected when
                you start a session from this plan.
              </p>
            ) : (
              <ul>
                {defaultSpots.map((spot, i) => (
                  <li key={spot.id}>
                    <DefaultSpotRow
                      spot={spot}
                      isFirst={i === 0}
                      isLast={i === defaultSpots.length - 1}
                      onMove={(dir) => moveDefault(spot.id, dir)}
                      onRemove={() => removeFromDefaults(spot.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => setView('search')}
              className="mt-1 flex w-full items-center gap-1 rounded-lg px-2 py-2 text-left text-sm text-text-link hover:bg-card-bg-inset"
            >
              <Plus size={14} aria-hidden />
              Add spot
            </button>
          </div>
        )}
      </div>
    </Sheet>
  )
}

/**
 * One spot in the block's default list. Removing here drops the spot from this
 * template's defaults only — it stays on the piece, active, with its history.
 */
function DefaultSpotRow({
  spot,
  isFirst,
  isLast,
  onMove,
  onRemove,
}: {
  spot: DefaultSpot
  isFirst: boolean
  isLast: boolean
  onMove: (direction: 'up' | 'down') => void
  onRemove: () => void
}) {
  return (
    <div className="flex items-center gap-1 border-b border-border-subtle py-2 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-text-primary">{spot.name}</p>
        {spot.location && (
          <p className="truncate text-xs text-text-secondary">{spot.location}</p>
        )}
      </div>
      <Menu
        triggerLabel={`Reorder ${spot.name}`}
        items={[
          {
            label: 'Move up',
            icon: <ArrowUp size={14} />,
            onSelect: () => onMove('up'),
            disabled: isFirst,
          },
          {
            label: 'Move down',
            icon: <ArrowDown size={14} />,
            onSelect: () => onMove('down'),
            disabled: isLast,
          },
        ]}
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${spot.name} from defaults`}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-card-bg-inset hover:text-text-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <X size={16} aria-hidden />
      </button>
    </div>
  )
}

/**
 * Search results, split into the piece's active spots and its retired ones.
 * Active spots add on one tap; retired spots route through the confirm panel,
 * which keeps un-retiring a deliberate gesture.
 */
function SpotSearchResults({
  active,
  retired,
  loading,
  busy,
  onAdd,
  onPickRetired,
}: {
  active: Spot[]
  retired: Spot[]
  loading: boolean
  busy: boolean
  onAdd: (spot: Spot) => void
  onPickRetired: (spot: Spot) => void
}) {
  if (loading) {
    return <p className="py-6 text-center text-sm text-text-tertiary">Loading…</p>
  }
  if (active.length === 0 && retired.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-text-tertiary">
        No other spots on this piece.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {active.length > 0 && (
        <SpotResultGroup
          heading="On this piece"
          spots={active}
          busy={busy}
          onPick={onAdd}
          hint={(s) =>
            s.last_practiced_at
              ? `last practiced ${formatRelativeDay(s.last_practiced_at)}`
              : 'never practiced'
          }
        />
      )}
      {retired.length > 0 && (
        <SpotResultGroup
          heading="Retired"
          spots={retired}
          busy={busy}
          faded
          onPick={onPickRetired}
          hint={(s) =>
            s.retired_at ? `retired ${formatRelativeDay(s.retired_at)}` : 'retired'
          }
        />
      )}
    </div>
  )
}

function SpotResultGroup({
  heading,
  spots,
  busy,
  faded = false,
  hint,
  onPick,
}: {
  heading: string
  spots: Spot[]
  busy: boolean
  faded?: boolean
  hint: (spot: Spot) => string
  onPick: (spot: Spot) => void
}) {
  return (
    <div>
      <h4 className="pb-1 text-xs uppercase tracking-wide text-text-tertiary">
        {heading}
      </h4>
      <ul className={faded ? 'opacity-60' : undefined}>
        {spots.map((spot) => (
          <li key={spot.id}>
            <button
              type="button"
              disabled={busy}
              onClick={() => onPick(spot)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-card-bg-inset disabled:opacity-50"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-text-primary">
                  {spot.name}
                </span>
                <span className="block truncate text-xs text-text-tertiary">
                  {[spot.location, hint(spot)].filter(Boolean).join(' · ')}
                </span>
              </span>
              <Plus size={16} aria-hidden className="shrink-0 text-text-link" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Inline confirmation for bringing a retired spot back. Deliberately a panel
 * inside the drawer rather than a modal: it's one extra tap to keep the
 * retire/un-retire gesture intentional, not a heavyweight interruption.
 */
function RetiredSpotConfirmPanel({
  spot,
  busy,
  onCancel,
  onConfirm,
}: {
  spot: Spot
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="rounded-xl border border-border-default bg-card-bg-inset p-4">
      <p className="text-sm font-semibold text-text-primary">
        Bring back &ldquo;{spot.name}&rdquo;?
      </p>
      <p className="mt-1 text-sm text-text-secondary">
        {spot.retired_at
          ? `It was retired ${formatRelativeDay(spot.retired_at)}. `
          : ''}
        This will un-retire it and add it to this plan.
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={onConfirm} disabled={busy}>
          Bring back
        </Button>
      </div>
    </div>
  )
}
