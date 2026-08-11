'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Check, Plus, X } from 'lucide-react'
import { useApi } from '@/lib/useApi'
import { formatRelativeDay } from '@/lib/dates'
import type { DefaultSpot, Spot } from '@/lib/types'
import { Button, Menu, Sheet } from '@/components/ui'
import { SearchCreateInput } from './SearchCreateInput'
import { SpotEditForm, type SpotFormValues } from './SpotEditForm'

/** Which of the drawer's mutually exclusive views is on screen. */
type View = 'list' | 'search' | 'create'

/** Where to put focus after the next render, when a view swap moves it. */
type FocusTarget = 'search' | 'addSpot'

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
  // A spot that was created but not yet added to the defaults, so a retry
  // after a failed add resumes instead of creating a second copy.
  const [createdSpot, setCreatedSpot] = useState<SpotFormValues & {
    id: number
  } | null>(null)
  // Spots un-retired during this drawer session — same idea, for `bringBack`.
  const unretired = useRef<Set<number>>(new Set())

  const searchInputRef = useRef<HTMLInputElement>(null)
  const addSpotRef = useRef<HTMLButtonElement>(null)
  const pendingFocus = useRef<FocusTarget | null>(null)

  const loadPiece = useCallback(async () => {
    // Retired spots are needed even though they're not offered by default —
    // the search surfaces them so they can be brought back.
    const detail = await api.getPiece(pieceId, { includeRetiredSpots: true })
    setSpots(detail.spots)
  }, [api, pieceId])

  const reloadPiece = useCallback(() => {
    loadPiece().catch(() =>
      setError("Couldn't load this piece's spots. Please try again."),
    )
  }, [loadPiece])

  useEffect(() => {
    reloadPiece()
  }, [reloadPiece])

  // Acting on a result unmounts the control that was clicked, which would drop
  // focus to the body. Applied after render so the target definitely exists.
  useEffect(() => {
    const target = pendingFocus.current
    if (!target) return
    pendingFocus.current = null
    if (target === 'search') searchInputRef.current?.focus()
    else addSpotRef.current?.focus()
  })

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
    pendingFocus.current = 'addSpot'
  }

  const addToDefaults = (spot: Spot) =>
    run(async () => {
      await api.addDefaultSpot(blockId, spot.id)
      await onChange()
      // Stay in the search: "one tap, no confirmation" means a second and third
      // spot shouldn't cost a reopen and a retype. The row just tapped moves to
      // the "already in this plan" group, which is the confirmation.
      pendingFocus.current = 'search'
    })

  const bringBack = (spot: Spot) =>
    run(async () => {
      // Un-retire first: a retired spot in a template's defaults would be
      // filtered right back out of the session it's meant to seed.
      if (!unretired.current.has(spot.id)) {
        await api.unretireSpot(spot.id)
        unretired.current.add(spot.id)
        // Reflect it even if the add below fails — the spot really is active
        // again, so the search should stop calling it retired.
        await loadPiece()
      }
      await api.addDefaultSpot(blockId, spot.id)
      await onChange()
      setConfirming(null)
      backToList()
    })

  const createSpot = async (values: SpotFormValues) => {
    await run(async () => {
      let id = createdSpot?.id
      if (id == null) {
        const spot = await api.createSpot(pieceId, {
          name: values.name,
          location: values.location || undefined,
        })
        id = spot.id
        setCreatedSpot({ ...values, id })
      } else if (
        createdSpot &&
        (createdSpot.name !== values.name ||
          createdSpot.location !== values.location)
      ) {
        // Resuming a half-finished create, but the user edited the fields
        // first — carry the edit over rather than adding the original.
        await api.updateSpot(id, {
          name: values.name,
          location: values.location,
        })
        setCreatedSpot({ ...values, id })
      }
      await api.addDefaultSpot(blockId, id)
      setCreatedSpot(null)
      await loadPiece()
      await onChange()
      backToList()
    })
  }

  const cancelCreate = () => {
    // A spot created by a since-failed attempt exists on the piece; reload so
    // the search offers it instead of pretending it isn't there.
    if (createdSpot) {
      setCreatedSpot(null)
      reloadPiece()
    }
    setView('search')
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

  const { activeMatches, retiredMatches, addedMatches, exactMatch } = useMemo(() => {
    const all = spots ?? []
    const q = norm(query)
    const matches = all.filter((s) => !q || norm(s.name).includes(q))
    const candidates = matches.filter((s) => !defaultIds.has(s.id))
    return {
      activeMatches: candidates.filter((s) => s.retired_at === null),
      retiredMatches: candidates.filter((s) => s.retired_at !== null),
      // Spots already in the defaults are shown, not silently dropped: typing
      // the name of one you know exists should say "already added", not
      // "no other spots" with the create link suppressed too.
      addedMatches: matches.filter((s) => defaultIds.has(s.id)),
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
      <div className="flex items-center justify-between gap-md px-2xl pb-md pt-2xl">
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
          className="mx-2xl mb-md rounded-lg bg-card-bg-inset px-lg py-md text-sm text-danger-text"
        >
          {error}
        </p>
      )}

      <div className="flex-1 overflow-y-auto px-2xl pb-2xl">
        {confirming ? (
          <RetiredSpotConfirmPanel
            spot={confirming}
            busy={busy}
            onCancel={() => setConfirming(null)}
            onConfirm={() => bringBack(confirming)}
          />
        ) : view === 'create' ? (
          <div>
            <h3 className="pb-md text-sm font-medium text-text-primary">
              New spot
            </h3>
            {/* "Create", not "Add to defaults": in the editor, creating a spot
                and adding it to this block's defaults are the same action. */}
            <SpotEditForm
              initialName={createdSpot?.name ?? trimmedQuery}
              initialLocation={createdSpot?.location ?? ''}
              submitLabel="Create"
              onSubmit={createSpot}
              onCancel={cancelCreate}
            />
          </div>
        ) : view === 'search' ? (
          <div className="space-y-lg">
            <SearchCreateInput
              value={query}
              onChange={setQuery}
              label="Search spots"
              placeholder="Search or add a spot…"
              inputRef={searchInputRef}
              autoFocus
            />
            <SpotSearchResults
              active={activeMatches}
              retired={retiredMatches}
              added={addedMatches}
              loading={spots === null}
              busy={busy}
              onAdd={addToDefaults}
              onPickRetired={setConfirming}
            />
            {showCreate && (
              <button
                type="button"
                onClick={() => setView('create')}
                className="flex w-full items-center gap-xs rounded-lg px-md py-md text-left text-sm text-text-link hover:bg-card-bg-inset"
              >
                <Plus size={14} aria-hidden />
                Create &ldquo;{trimmedQuery}&rdquo;
              </button>
            )}
            <Button variant="ghost" size="sm" onClick={backToList}>
              Cancel
            </Button>
          </div>
        ) : (
          <div>
            <h3 className="pb-xs text-xs uppercase tracking-wide text-text-tertiary">
              Default spots
            </h3>
            {defaultSpots.length === 0 ? (
              <p className="py-lg text-sm italic text-text-tertiary">
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
              ref={addSpotRef}
              type="button"
              onClick={() => setView('search')}
              className="mt-xs flex w-full items-center gap-xs rounded-lg px-md py-md text-left text-sm text-text-link hover:bg-card-bg-inset"
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
    <div className="flex items-center gap-xs border-b border-border-subtle py-md last:border-b-0">
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
 * Search results, split into the piece's active spots, its retired ones, and
 * the ones already in this block's defaults. Active spots add on one tap;
 * retired spots route through the confirm panel, which keeps un-retiring a
 * deliberate gesture; already-added spots are shown inert so a search for one
 * isn't a dead end.
 */
function SpotSearchResults({
  active,
  retired,
  added,
  loading,
  busy,
  onAdd,
  onPickRetired,
}: {
  active: Spot[]
  retired: Spot[]
  added: Spot[]
  loading: boolean
  busy: boolean
  onAdd: (spot: Spot) => void
  onPickRetired: (spot: Spot) => void
}) {
  if (loading) {
    // 24px has no spacing token; keeping the raw value.
    return <p className="py-6 text-center text-sm text-text-tertiary">Loading…</p>
  }
  if (active.length === 0 && retired.length === 0 && added.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-text-tertiary">
        No other spots on this piece.
      </p>
    )
  }

  return (
    <div className="space-y-lg">
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
      {added.length > 0 && <AddedSpotGroup spots={added} />}
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
      <h3 className="pb-xs text-xs uppercase tracking-wide text-text-tertiary">
        {heading}
      </h3>
      <ul className={faded ? 'opacity-60' : undefined}>
        {spots.map((spot) => (
          <li key={spot.id}>
            <button
              type="button"
              disabled={busy}
              onClick={() => onPick(spot)}
              className="flex w-full items-center gap-md rounded-lg px-md py-md text-left hover:bg-card-bg-inset disabled:opacity-50"
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

/** Matches that are already defaults — shown so the search never dead-ends. */
function AddedSpotGroup({ spots }: { spots: Spot[] }) {
  return (
    <div>
      <h3 className="pb-xs text-xs uppercase tracking-wide text-text-tertiary">
        Already in this plan
      </h3>
      <ul>
        {spots.map((spot) => (
          <li
            key={spot.id}
            className="flex items-center gap-md px-md py-md text-text-secondary"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{spot.name}</span>
              {spot.location && (
                <span className="block truncate text-xs text-text-tertiary">
                  {spot.location}
                </span>
              )}
            </span>
            <span className="flex shrink-0 items-center gap-xs text-xs text-text-tertiary">
              <Check size={14} aria-hidden />
              Added
            </span>
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
 *
 * It replaces the result that was tapped, so it takes focus and announces
 * itself — otherwise focus lands on the body and a screen reader hears
 * nothing at all.
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
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    panelRef.current?.focus()
  }, [])

  return (
    <div
      ref={panelRef}
      role="alertdialog"
      aria-labelledby="unretire-title"
      aria-describedby="unretire-body"
      tabIndex={-1}
      className="rounded-xl border border-border-default bg-card-bg-inset p-2xl outline-none"
    >
      <p id="unretire-title" className="text-sm font-semibold text-text-primary">
        Bring back &ldquo;{spot.name}&rdquo;?
      </p>
      <p id="unretire-body" className="mt-xs text-sm text-text-secondary">
        {spot.retired_at
          ? `It was retired ${formatRelativeDay(spot.retired_at)}. `
          : ''}
        This will un-retire it and add it to this plan.
      </p>
      <div className="mt-lg flex justify-end gap-md">
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
