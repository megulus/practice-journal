'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useApi } from '@/lib/useApi'
import { Button, Pill } from '@/components/ui'
import {
  HistoryList,
  InsightsPanel,
  ProgressSubTabs,
  type ProgressSubTab,
} from '@/components/progress'
import type { Instrument } from '@/lib/types'

/**
 * Progress tab (spec §5.7): instrument toggle over two sub-tabs — History
 * (#149) and Insights (#150).
 *
 * The pattern-level suggestion card the spec puts above both sub-tabs isn't
 * here yet — the rules engine has a pattern tier but no endpoint exposes it
 * (#253).
 */
export default function ProgressPage() {
  const api = useApi()
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [selectedInstrumentId, setSelectedInstrumentId] = useState<
    number | null
  >(null)
  const [tab, setTab] = useState<ProgressSubTab>('history')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadInstruments = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await api.listInstruments()
      setInstruments(list)
      setSelectedInstrumentId((prev) => prev ?? list[0]?.id ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load instruments')
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    loadInstruments()
  }, [loadInstruments])

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-text-secondary">
        Loading…
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-16 text-center">
        <p className="mb-3 text-danger-text" role="alert">
          {error}
        </p>
        <Button variant="ghost" size="sm" onClick={loadInstruments}>
          Retry
        </Button>
      </div>
    )
  }

  if (instruments.length === 0) {
    return (
      <div className="py-16 text-center">
        <h1 className="mb-2 text-xl font-semibold text-text-primary">
          Progress
        </h1>
        <p className="mb-6 text-text-secondary">
          Add an instrument to start tracking your practice.
        </p>
        <Link
          href="/profile"
          className="inline-block rounded-lg bg-primary px-6 py-2.5 font-medium text-text-on-primary-action transition-colors hover:bg-primary-hover"
        >
          Go to Profile
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-text-primary">Progress</h1>

      {instruments.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {instruments.map((inst) => (
            <Pill
              key={inst.id}
              variant="instrument"
              active={inst.id === selectedInstrumentId}
              onClick={() => setSelectedInstrumentId(inst.id)}
              className="whitespace-nowrap"
            >
              {inst.name}
            </Pill>
          ))}
        </div>
      )}

      <ProgressSubTabs value={tab} onChange={setTab} />

      <div
        role="tabpanel"
        id={`progress-panel-${tab}`}
        aria-labelledby={`progress-tab-${tab}`}
        // Only focusable when the panel has no focusable content of its own —
        // the Insights charts are static. History is full of controls, and
        // giving it a tab stop too would just add a redundant one — see the
        // ARIA authoring practices for the tabpanel pattern.
        tabIndex={tab === 'history' ? undefined : 0}
      >
        {tab === 'history' ? (
          <HistoryList instrumentId={selectedInstrumentId} />
        ) : (
          <InsightsPanel instrumentId={selectedInstrumentId} />
        )}
      </div>
    </div>
  )
}
