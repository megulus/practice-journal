'use client'

import { useEffect, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { useApi } from '@/lib/useApi'
import { Button, Pill, Sheet, TextInput } from './ui'
import { SearchCreateInput } from './repertoire/SearchCreateInput'
import type {
  BlockCreate,
  CuratedBlock,
  LibraryPiece,
  RecentBlock,
} from '@/lib/types'

export type BlockLibraryTab = 'curated' | 'recent' | 'repertoire'

type Tab = BlockLibraryTab

const ALL_TABS: Tab[] = ['curated', 'recent', 'repertoire']

const norm = (s: string) => s.trim().toLowerCase()

/**
 * Bottom-sheet block library for adding a block to a section.
 *
 * Three tabs: the curated library, recently used blocks, and "Your repertoire"
 * — the user's pieces for this instrument. Picking a piece adds an *empty*
 * repertoire block; its default spots are configured afterwards in the spot
 * management drawer, so this sheet stays a picker that returns one thing per
 * visit (repertoire doc, "Adding a repertoire block to a section").
 */
export default function AddBlockSheet({
  sectionName,
  instrumentCategory,
  instrumentId,
  tabs = ALL_TABS,
  onAdd,
  onClose,
}: {
  sectionName: string
  /** Canonical category (`Instrument.instrument_category`), not the name — the
   * curated library is keyed by category and users rename instruments. */
  instrumentCategory: string
  instrumentId: number
  /** Which tabs to offer, in order. Defaults to all three. The active session
   * passes the standard-block subset: mid-session repertoire is handled by
   * `RepertoireBlock`'s "Add a spot" flow, not here (#182). */
  tabs?: Tab[]
  onAdd: (data: BlockCreate) => Promise<void>
  onClose: () => void
}) {
  const api = useApi()
  const [tab, setTab] = useState<Tab>(tabs[0])
  const [query, setQuery] = useState('')
  const [curated, setCurated] = useState<CuratedBlock[]>([])
  const [recent, setRecent] = useState<RecentBlock[]>([])
  const [pieces, setPieces] = useState<LibraryPiece[]>([])
  const [creatingPiece, setCreatingPiece] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Curated search runs server-side, so it re-queries as you type.
  useEffect(() => {
    if (tab !== 'curated') return
    setLoading(true)
    api
      .browseCuratedBlocks({
        instrument: instrumentCategory,
        q: query || undefined,
      })
      .then(setCurated)
      .catch(() => setCurated([]))
      .finally(() => setLoading(false))
  }, [tab, query, api, instrumentCategory])

  useEffect(() => {
    if (tab !== 'recent') return
    setLoading(true)
    api
      .listRecentBlocks(instrumentId, 25)
      .then(setRecent)
      .catch(() => setRecent([]))
      .finally(() => setLoading(false))
  }, [tab, api, instrumentId])

  // The repertoire list is small and fully loaded, so its search filters
  // client-side — no round trip per keystroke.
  useEffect(() => {
    if (tab !== 'repertoire') return
    setLoading(true)
    api
      .listRepertoirePieces(instrumentId)
      .then((r) => setPieces(r.pieces))
      .catch(() => setPieces([]))
      .finally(() => setLoading(false))
  }, [tab, api, instrumentId])

  const submit = async (data: BlockCreate) => {
    if (submitting) return
    setSubmitting(true)
    try {
      await onAdd(data)
      onClose()
    } catch {
      setError("Couldn't add that block. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleAddCustom = () => {
    const name = query.trim()
    if (!name) return
    submit({ name })
  }

  /** Create the piece, then add the (empty) repertoire block that references it. */
  const handleCreatePiece = async (name: string, composer: string) => {
    if (submitting) return
    setSubmitting(true)
    try {
      const piece = await api.createPiece(instrumentId, {
        name,
        composer_or_source: composer || undefined,
      })
      await onAdd({ piece_id: piece.id })
      onClose()
    } catch {
      setError("Couldn't add that piece. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const filteredPieces = pieces.filter(
    (p) => !query.trim() || norm(p.name).includes(norm(query)),
  )
  const pieceExactMatch = pieces.some((p) => norm(p.name) === norm(query))

  return (
    <Sheet
      onClose={onClose}
      aria-label={`Add block to ${sectionName}`}
      className="w-full max-w-lg bg-card-bg rounded-t-2xl shadow-xl flex flex-col max-h-[85vh]"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-border-default">
        <p className="text-sm text-text-secondary">Add to: {sectionName}</p>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 px-4 pt-3">
        {tabs.map((t) => (
          <Pill
            key={t}
            variant="instrument"
            active={tab === t}
            onClick={() => {
              setTab(t)
              // The query means something different on each tab; carrying it
              // across would filter the new tab by the old tab's intent.
              setQuery('')
              setCreatingPiece(false)
              setError(null)
            }}
          >
            {t === 'curated' ? 'Curated' : t === 'recent' ? 'Recent' : 'Your rep.'}
          </Pill>
        ))}
      </div>

      {/* Search (curated + repertoire — both search-doubles-as-create) */}
      {tab === 'curated' && (
        <div className="px-4 pt-3">
          <div className="relative">
            <Search
              size={16}
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search blocks or type your own..."
              className="w-full rounded-md border border-border-input bg-input-bg py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-input-focus focus:outline-none"
            />
          </div>
        </div>
      )}
      {tab === 'repertoire' && !creatingPiece && (
        <div className="px-4 pt-3">
          <SearchCreateInput
            value={query}
            onChange={setQuery}
            label="Search pieces"
            placeholder="Search or add piece…"
          />
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="mx-4 mt-3 rounded-lg bg-card-bg-inset px-3 py-2 text-sm text-danger-text"
        >
          {error}
        </p>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {tab === 'curated' && (
          <CuratedList
            blocks={curated}
            loading={loading}
            onPick={(b) =>
              submit({
                name: b.name,
                curated_block_id: b.id,
                description: b.description ?? undefined,
                estimated_duration_minutes: b.default_duration_minutes,
              })
            }
          />
        )}
        {tab === 'recent' && (
          <RecentList
            blocks={recent}
            loading={loading}
            onPick={(b) =>
              submit({
                name: b.name,
                curated_block_id: b.curated_block_id ?? undefined,
              })
            }
          />
        )}
        {tab === 'repertoire' &&
          (creatingPiece ? (
            <NewPieceForm
              initialName={query.trim()}
              submitting={submitting}
              onCancel={() => setCreatingPiece(false)}
              onCreate={handleCreatePiece}
            />
          ) : (
            <RepertoireList
              pieces={filteredPieces}
              loading={loading}
              query={query.trim()}
              showCreate={query.trim().length > 0 && !pieceExactMatch}
              onPick={(p) => submit({ piece_id: p.id })}
              onCreate={() => setCreatingPiece(true)}
            />
          ))}
      </div>

      {/* Custom add (curated tab) */}
      {tab === 'curated' && query.trim().length > 0 && (
        <div className="border-t border-border-default px-4 py-3">
          <Button
            variant="primary"
            fullWidth
            onClick={handleAddCustom}
            disabled={submitting}
          >
            Add &quot;{query.trim()}&quot;
          </Button>
        </div>
      )}
    </Sheet>
  )
}

function CuratedList({
  blocks,
  loading,
  onPick,
}: {
  blocks: CuratedBlock[]
  loading: boolean
  onPick: (b: CuratedBlock) => void
}) {
  if (loading) return <p className="text-center text-sm text-text-tertiary py-8">Loading…</p>
  if (blocks.length === 0) {
    return (
      <p className="text-center text-sm text-text-tertiary py-8">
        No matches. Type a name and tap Add to create your own.
      </p>
    )
  }
  return (
    <ul className="space-y-1">
      {blocks.map((b) => (
        <li key={b.id}>
          <button
            onClick={() => onPick(b)}
            className="w-full text-left flex items-center justify-between gap-3 px-2 py-2 rounded-lg hover:bg-card-bg-inset"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">{b.name}</p>
              {b.description && (
                <p className="text-xs text-text-secondary truncate">{b.description}</p>
              )}
            </div>
            <span className="shrink-0 text-xs text-text-tertiary tabular-nums">
              {b.usage_percentage}%
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

/**
 * "Your repertoire" tab body: the instrument's pieces, filtered by the search
 * text, with a create affordance when nothing matches what was typed.
 */
function RepertoireList({
  pieces,
  loading,
  query,
  showCreate,
  onPick,
  onCreate,
}: {
  pieces: LibraryPiece[]
  loading: boolean
  query: string
  showCreate: boolean
  onPick: (p: LibraryPiece) => void
  onCreate: () => void
}) {
  if (loading) {
    return <p className="py-8 text-center text-sm text-text-tertiary">Loading…</p>
  }

  return (
    <div>
      {pieces.length === 0 ? (
        <div className="py-8 text-center text-sm text-text-tertiary">
          <p>{query ? 'No matching pieces.' : 'No pieces yet.'}</p>
          <p className="mt-1 text-xs">Type to create one.</p>
        </div>
      ) : (
        <ul className="space-y-1">
          {pieces.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => onPick(p)}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left hover:bg-card-bg-inset"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-text-primary">
                    {p.name}
                  </span>
                  {p.composer_or_source && (
                    <span className="block truncate text-xs text-text-secondary">
                      {p.composer_or_source}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-xs text-text-tertiary">
                  {p.active_spot_count === 1
                    ? '1 spot'
                    : `${p.active_spot_count} spots`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {showCreate && (
        <button
          type="button"
          onClick={onCreate}
          className="mt-1 flex w-full items-center gap-1 rounded-lg px-2 py-2 text-left text-sm text-text-link hover:bg-card-bg-inset"
        >
          <Plus size={14} aria-hidden />
          Create &ldquo;{query}&rdquo;
        </button>
      )}
    </div>
  )
}

/** Name + optional composer, then straight to the repertoire block. */
function NewPieceForm({
  initialName,
  submitting,
  onCancel,
  onCreate,
}: {
  initialName: string
  submitting: boolean
  onCancel: () => void
  onCreate: (name: string, composer: string) => void
}) {
  const [name, setName] = useState(initialName)
  const [composer, setComposer] = useState('')

  return (
    <form
      className="space-y-md"
      onSubmit={(e) => {
        e.preventDefault()
        const trimmed = name.trim()
        if (!trimmed || submitting) return
        onCreate(trimmed, composer.trim())
      }}
    >
      <p className="text-sm font-medium text-text-primary">New piece</p>
      <TextInput
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Piece name"
        aria-label="New piece name"
        autoFocus
      />
      <TextInput
        value={composer}
        onChange={(e) => setComposer(e.target.value)}
        placeholder="Composer or source (optional)"
        aria-label="Composer or source"
      />
      <div className="flex gap-sm">
        <Button type="submit" size="sm" disabled={submitting || !name.trim()}>
          Create
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function RecentList({
  blocks,
  loading,
  onPick,
}: {
  blocks: RecentBlock[]
  loading: boolean
  onPick: (b: RecentBlock) => void
}) {
  if (loading) return <p className="text-center text-sm text-text-tertiary py-8">Loading…</p>
  if (blocks.length === 0) {
    return <p className="text-center text-sm text-text-tertiary py-8">No recent blocks yet.</p>
  }
  return (
    <ul className="space-y-1">
      {blocks.map((b, i) => (
        <li key={`${b.name}-${b.last_used_at}-${i}`}>
          <button
            onClick={() => onPick(b)}
            className="w-full text-left px-2 py-2 rounded-lg hover:bg-card-bg-inset"
          >
            <p className="text-sm font-medium text-text-primary truncate">{b.name}</p>
          </button>
        </li>
      ))}
    </ul>
  )
}
