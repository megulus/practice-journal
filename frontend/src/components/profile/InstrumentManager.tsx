'use client'

import { useCallback, useEffect, useState } from 'react'
import { useApi } from '@/lib/useApi'
import type { Instrument } from '@/lib/types'
import { InstrumentCard } from './InstrumentCard'
import { AddInstrument } from './AddInstrument'

/**
 * "My instruments" section of the Profile tab: lists the user's instruments as
 * editable cards and lets them add new ones. Mutations refetch the list.
 */
export function InstrumentManager() {
  const api = useApi()
  const [instruments, setInstruments] = useState<Instrument[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setInstruments(await api.listInstruments())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load instruments')
    }
  }, [api])

  useEffect(() => {
    load()
  }, [load])

  if (error) {
    return <p className="text-sm text-danger-text">{error}</p>
  }
  if (instruments === null) {
    return <p className="text-sm text-text-secondary">Loading…</p>
  }

  return (
    <div className="space-y-3">
      {instruments.length === 0 ? (
        <p className="text-sm text-text-secondary">
          No instruments yet — add one to start planning.
        </p>
      ) : (
        <ul className="space-y-3">
          {instruments.map((instrument) => (
            <li key={instrument.id}>
              <InstrumentCard instrument={instrument} onChange={load} />
            </li>
          ))}
        </ul>
      )}
      <AddInstrument onAdded={load} />
    </div>
  )
}
