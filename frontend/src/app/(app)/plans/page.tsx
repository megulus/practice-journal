'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useApi } from '@/lib/useApi'
import { Button, Card, Pill } from '@/components/ui'
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
      <div className="flex justify-center py-16 text-text-secondary">
        Loading…
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-16 text-center">
        <p className="mb-3 text-danger-text">{error}</p>
        <Button variant="ghost" size="sm" onClick={loadInstruments}>
          Retry
        </Button>
      </div>
    )
  }

  if (instruments.length === 0) {
    return (
      <div className="py-16 text-center text-text-secondary">
        Add an instrument to start planning.
      </div>
    )
  }

  const showInstrumentToggle = instruments.length > 1
  const activeTemplates = templates.filter((t) => t.is_active)
  const archivedTemplates = templates.filter((t) => !t.is_active)

  const openPlan = (id: number) => router.push(`/plans/${id}`)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text-primary">Plans</h1>
        <Button size="sm" onClick={handleCreate} disabled={creating}>
          New plan
        </Button>
      </div>

      {showInstrumentToggle && (
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

      {templates.length === 0 ? (
        <Card className="text-center">
          <p className="mb-4 text-sm text-text-secondary">No plans yet.</p>
          <Button onClick={handleCreate} disabled={creating}>
            Create your first plan
          </Button>
        </Card>
      ) : (
        <div className="space-y-6">
          <PlanGroup label="Active" templates={activeTemplates} onOpen={openPlan} />
          <PlanGroup
            label="Archived"
            templates={archivedTemplates}
            onOpen={openPlan}
          />
        </div>
      )}
    </div>
  )
}

function PlanGroup({
  label,
  templates,
  onOpen,
}: {
  label: string
  templates: TemplateListItem[]
  onOpen: (id: number) => void
}) {
  if (templates.length === 0) return null
  return (
    <section>
      <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-text-tertiary">
        {label}
      </h2>
      <ul className="space-y-2">
        {templates.map((t) => (
          <PlanRow key={t.id} template={t} onOpen={() => onOpen(t.id)} />
        ))}
      </ul>
    </section>
  )
}

function PlanRow({
  template: t,
  onOpen,
}: {
  template: TemplateListItem
  onOpen: () => void
}) {
  const sessionLabel = `${t.session_count} session${t.session_count !== 1 ? 's' : ''}`
  return (
    <li>
      <button
        onClick={onOpen}
        className="block w-full rounded-xl border border-border-default bg-card-bg p-4 text-left transition-colors hover:border-border-input focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-medium text-text-primary">{t.name}</p>
            {t.description && (
              <p className="truncate text-sm text-text-secondary">
                {t.description}
              </p>
            )}
            <p className="mt-1 text-xs text-text-tertiary">
              {sessionLabel} · ~{t.estimated_total_minutes} min total
            </p>
          </div>
          {t.is_active && (
            <span className="shrink-0 rounded-pill bg-primary-subtle-bg px-2 py-0.5 text-xs font-medium text-primary-subtle-text">
              Active
            </span>
          )}
        </div>
      </button>
    </li>
  )
}
