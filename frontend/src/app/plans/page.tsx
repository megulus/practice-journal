'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useApi } from '@/lib/useApi'
import type { Instrument, TemplateListItem } from '@/lib/types'

export default function PlansPage() {
  const api = useApi()
  const router = useRouter()
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [selectedInstrumentId, setSelectedInstrumentId] = useState<number | null>(null)
  const [templates, setTemplates] = useState<TemplateListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const loadInstruments = useCallback(async () => {
    try {
      setLoading(true)
      const list = await api.listInstruments()
      setInstruments(list)
      setSelectedInstrumentId((prev) => prev ?? list[0]?.id ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load instruments')
    } finally {
      setLoading(false)
    }
  }, [api])

  const loadTemplates = useCallback(
    async (instrumentId: number) => {
      try {
        const list = await api.listTemplates(instrumentId)
        setTemplates(list)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load plans')
      }
    },
    [api]
  )

  useEffect(() => {
    loadInstruments()
  }, [loadInstruments])

  useEffect(() => {
    if (selectedInstrumentId != null) loadTemplates(selectedInstrumentId)
  }, [selectedInstrumentId, loadTemplates])

  const handleCreate = async () => {
    if (selectedInstrumentId == null || creating) return
    setCreating(true)
    try {
      const template = await api.createTemplate(selectedInstrumentId, {
        name: 'New plan',
      })
      // Seed the template with a first session so the editor has something to render.
      await api.createTemplateSession(template.id, { name: 'Session 1' })
      router.push(`/plans/${template.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create plan')
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen px-6">
        <div className="text-center">
          <p className="text-red-600 mb-2">{error}</p>
          <button
            onClick={loadInstruments}
            className="text-primary-600 underline text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (instruments.length === 0) {
    return (
      <main className="min-h-screen bg-gray-50 px-4 pt-6">
        <div className="max-w-lg mx-auto text-center mt-16">
          <p className="text-gray-500">Add an instrument to start planning.</p>
        </div>
      </main>
    )
  }

  const showInstrumentToggle = instruments.length > 1

  return (
    <main className="min-h-screen bg-gray-50 px-4 pt-6">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold text-gray-900">Plans</h1>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            New plan
          </button>
        </div>

        {showInstrumentToggle && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
            {instruments.map((inst) => {
              const active = inst.id === selectedInstrumentId
              return (
                <button
                  key={inst.id}
                  onClick={() => setSelectedInstrumentId(inst.id)}
                  className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap border transition-colors ${
                    active
                      ? 'bg-primary-100 border-primary-300 text-primary-800'
                      : 'bg-white border-gray-200 text-gray-600'
                  }`}
                >
                  {inst.name}
                </button>
              )
            })}
          </div>
        )}

        {templates.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-500 text-sm mb-4">No plans yet.</p>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              Create your first plan
            </button>
          </div>
        ) : (
          <ul className="space-y-2">
            {templates.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => router.push(`/plans/${t.id}`)}
                  className="w-full text-left bg-white rounded-xl border border-gray-200 p-4 hover:border-primary-300 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {t.name}
                      </p>
                      {t.description && (
                        <p className="text-sm text-gray-500 truncate">
                          {t.description}
                        </p>
                      )}
                    </div>
                    {t.is_active && (
                      <span className="shrink-0 px-2 py-0.5 bg-teal-100 text-teal-700 text-xs rounded-full">
                        Active
                      </span>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
