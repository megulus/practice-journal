'use client'

import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { useApi } from '@/lib/useApi'
import { Button, Pill, Sheet } from './ui'
import type {
  CuratedBlock,
  RecentBlock,
  StandardBlockCreate,
} from '@/lib/types'

type Tab = 'curated' | 'recent' | 'repertoire'

/**
 * Bottom-sheet block library for adding a block to a section.
 *
 * Repertoire tab is stubbed in this PR (empty state); the full flow lands in
 * #167 along with the spot management drawer.
 */
export default function AddBlockSheet({
  sectionName,
  instrumentName,
  instrumentId,
  onAdd,
  onClose,
}: {
  sectionName: string
  instrumentName: string
  instrumentId: number
  onAdd: (data: StandardBlockCreate) => Promise<void>
  onClose: () => void
}) {
  const api = useApi()
  const [tab, setTab] = useState<Tab>('curated')
  const [query, setQuery] = useState('')
  const [curated, setCurated] = useState<CuratedBlock[]>([])
  const [recent, setRecent] = useState<RecentBlock[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (tab === 'curated') {
      setLoading(true)
      api
        .browseCuratedBlocks({
          instrument: instrumentName.toLowerCase(),
          q: query || undefined,
        })
        .then(setCurated)
        .catch(() => setCurated([]))
        .finally(() => setLoading(false))
    } else if (tab === 'recent') {
      setLoading(true)
      api
        .listRecentBlocks(instrumentId, 25)
        .then(setRecent)
        .catch(() => setRecent([]))
        .finally(() => setLoading(false))
    }
  }, [tab, query, api, instrumentName, instrumentId])

  const submit = async (data: StandardBlockCreate) => {
    if (submitting) return
    setSubmitting(true)
    try {
      await onAdd(data)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const handleAddCustom = () => {
    const name = query.trim()
    if (!name) return
    submit({ name })
  }

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
        {(['curated', 'recent', 'repertoire'] as Tab[]).map((t) => (
          <Pill
            key={t}
            variant="instrument"
            active={tab === t}
            onClick={() => setTab(t)}
          >
            {t === 'curated' ? 'Curated' : t === 'recent' ? 'Recent' : 'Your rep.'}
          </Pill>
        ))}
      </div>

      {/* Search (curated only) */}
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
        {tab === 'repertoire' && (
          <div className="py-12 text-center text-sm text-text-tertiary">
            <p>Repertoire blocks coming soon.</p>
            <p className="text-xs mt-1">Tracked in #167.</p>
          </div>
        )}
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
