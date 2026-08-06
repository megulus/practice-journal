'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useApi } from '@/lib/useApi'
import { RepertoireLibrary } from '@/components/repertoire'
import type { Instrument } from '@/lib/types'

export default function RepertoirePage() {
  const api = useApi()
  const router = useRouter()
  const params = useParams<{ instrumentId: string }>()
  const instrumentId = Number(params.instrumentId)

  const [instrument, setInstrument] = useState<Instrument | null>(null)
  const [notFound, setNotFound] = useState(false)

  // The instruments list is the only read that names an instrument, so the
  // header resolves the name from it rather than adding a detail fetch.
  useEffect(() => {
    if (!Number.isFinite(instrumentId)) {
      setNotFound(true)
      return
    }
    let cancelled = false
    api
      .listInstruments()
      .then((list) => {
        if (cancelled) return
        const match = list.find((i) => i.id === instrumentId)
        if (match) setInstrument(match)
        else setNotFound(true)
      })
      .catch(() => {
        if (!cancelled) setNotFound(true)
      })
    return () => {
      cancelled = true
    }
  }, [api, instrumentId])

  if (notFound) {
    return (
      <div className="py-16 text-center">
        <p className="mb-3 text-text-secondary">Instrument not found.</p>
        <button
          type="button"
          onClick={() => router.push('/profile')}
          className="text-sm text-text-link transition-colors hover:text-text-primary"
        >
          Back to Profile
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-lg">
      <button
        type="button"
        onClick={() => router.push('/profile')}
        className="text-sm text-text-secondary transition-colors hover:text-text-primary"
      >
        ← Profile
      </button>

      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Repertoire</h1>
        <p className="text-sm text-text-secondary">
          {instrument?.name ?? ' '}
        </p>
      </div>

      {Number.isFinite(instrumentId) && (
        <RepertoireLibrary instrumentId={instrumentId} />
      )}
    </div>
  )
}
