'use client'

import { useEffect, useRef, useState } from 'react'
import { useApi } from '@/lib/useApi'
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
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  // Lock body scroll while open and close on Escape.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    closeButtonRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

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
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Add block to ${sectionName}`}
        className="w-full max-w-lg bg-white rounded-t-2xl shadow-xl flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-gray-100">
          <p className="text-sm text-gray-500">Add to: {sectionName}</p>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-800 px-2 py-1 touch-manipulation"
          >
            Cancel
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-3">
          {(['curated', 'recent', 'repertoire'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-full text-sm border ${
                tab === t
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white border-gray-200 text-gray-600'
              }`}
            >
              {t === 'curated' ? 'Curated' : t === 'recent' ? 'Recent' : 'Your rep.'}
            </button>
          ))}
        </div>

        {/* Search (curated only) */}
        {tab === 'curated' && (
          <div className="px-4 pt-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search blocks or type your own..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary-300"
            />
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
            <div className="py-12 text-center text-sm text-gray-400">
              <p>Repertoire blocks coming soon.</p>
              <p className="text-xs mt-1">Tracked in #167.</p>
            </div>
          )}
        </div>

        {/* Custom add (curated tab) */}
        {tab === 'curated' && query.trim().length > 0 && (
          <div className="border-t border-gray-100 px-4 py-3">
            <button
              onClick={handleAddCustom}
              disabled={submitting}
              className="w-full px-3 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              Add &quot;{query.trim()}&quot;
            </button>
          </div>
        )}
      </div>
    </div>
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
  if (loading) return <p className="text-center text-sm text-gray-400 py-8">Loading...</p>
  if (blocks.length === 0) {
    return (
      <p className="text-center text-sm text-gray-400 py-8">
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
            className="w-full text-left flex items-center justify-between gap-3 px-2 py-2 rounded-lg hover:bg-gray-50"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{b.name}</p>
              {b.description && (
                <p className="text-xs text-gray-500 truncate">{b.description}</p>
              )}
            </div>
            <span className="shrink-0 text-xs text-gray-400 tabular-nums">
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
  if (loading) return <p className="text-center text-sm text-gray-400 py-8">Loading...</p>
  if (blocks.length === 0) {
    return <p className="text-center text-sm text-gray-400 py-8">No recent blocks yet.</p>
  }
  return (
    <ul className="space-y-1">
      {blocks.map((b, i) => (
        <li key={`${b.name}-${b.last_used_at}-${i}`}>
          <button
            onClick={() => onPick(b)}
            className="w-full text-left px-2 py-2 rounded-lg hover:bg-gray-50"
          >
            <p className="text-sm font-medium text-gray-900 truncate">{b.name}</p>
          </button>
        </li>
      ))}
    </ul>
  )
}
