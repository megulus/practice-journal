'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useApi } from '@/lib/useApi'
import type {
  Instrument,
  Template,
  TemplateSession,
  Section,
  StandardBlockCreate,
  SectionType,
} from '@/lib/types'
import SessionTabs from '@/components/SessionTabs'
import SectionCard from '@/components/SectionCard'
import AddBlockSheet from '@/components/AddBlockSheet'
import ConfirmDialog from '@/components/ConfirmDialog'

// TODO(#168): replace hardcoded section_type with a real picker (template
// editor + freeform session). All new sections in this PR are 'other'.
const DEFAULT_SECTION_TYPE: SectionType = 'other'

export default function TemplateEditorPage() {
  const api = useApi()
  const params = useParams()
  const router = useRouter()
  const templateId = Number(params?.id)

  const [template, setTemplate] = useState<Template | null>(null)
  const [instrument, setInstrument] = useState<Instrument | null>(null)
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addBlockSectionId, setAddBlockSectionId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<{
    kind: 'template' | 'session' | 'section' | 'block'
    id: number
    label: string
  } | null>(null)

  // ---------------------------------------------------------------------
  // Initial load
  // ---------------------------------------------------------------------
  const loadTemplate = useCallback(async () => {
    if (!Number.isFinite(templateId)) {
      setError('Invalid plan id')
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const t = await api.getTemplate(templateId)
      setTemplate(t)
      setSelectedSessionId((prev) => prev ?? t.sessions[0]?.id ?? null)
      const inst = (await api.listInstruments()).find(
        (i) => i.id === t.instrument_id
      )
      setInstrument(inst ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plan')
    } finally {
      setLoading(false)
    }
  }, [api, templateId])

  useEffect(() => {
    loadTemplate()
  }, [loadTemplate])

  // Correct selectedSessionId if the session it points at no longer exists
  // (e.g., another tab deleted it, or a refresh dropped it).
  useEffect(() => {
    if (!template) return
    if (selectedSessionId == null) return
    if (template.sessions.some((s) => s.id === selectedSessionId)) return
    setSelectedSessionId(template.sessions[0]?.id ?? null)
  }, [template, selectedSessionId])

  const refresh = useCallback(async () => {
    const t = await api.getTemplate(templateId)
    setTemplate(t)
  }, [api, templateId])

  // ---------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------
  const selectedSession: TemplateSession | null = useMemo(() => {
    if (!template) return null
    return (
      template.sessions.find((s) => s.id === selectedSessionId) ??
      template.sessions[0] ??
      null
    )
  }, [template, selectedSessionId])

  const sessionCount = template?.sessions.length ?? 0

  // ---------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------
  const renameTemplate = async (name: string) => {
    if (!template || name === template.name) return
    await api.updateTemplate(template.id, { name })
    setTemplate({ ...template, name })
  }

  const setActive = async (isActive: boolean) => {
    if (!template) return
    await api.updateTemplate(template.id, { is_active: isActive })
    setTemplate({ ...template, is_active: isActive })
  }

  const addSession = async () => {
    if (!template || busy) return
    setBusy(true)
    try {
      const next = await api.createTemplateSession(template.id, {
        name: `Session ${template.sessions.length + 1}`,
      })
      setSelectedSessionId(next.id)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const renameSession = async (sessionId: number, name: string) => {
    await api.updateTemplateSession(sessionId, { name })
    await refresh()
  }

  const updateSessionFocus = async (sessionId: number, focus: string) => {
    await api.updateTemplateSession(sessionId, { focus_description: focus })
    await refresh()
  }

  const deleteSession = async (sessionId: number) => {
    if (!template || template.sessions.length <= 1) return
    await api.deleteTemplateSession(sessionId)
    if (selectedSessionId === sessionId) {
      const remaining = template.sessions.filter((s) => s.id !== sessionId)
      setSelectedSessionId(remaining[0]?.id ?? null)
    }
    await refresh()
  }

  const addSection = async () => {
    if (!selectedSession) return
    await api.createSection(selectedSession.id, {
      name: 'New section',
      section_type: DEFAULT_SECTION_TYPE,
      estimated_duration_minutes: 5,
    })
    await refresh()
  }

  const renameSection = async (sectionId: number, name: string) => {
    await api.updateSection(sectionId, { name })
    await refresh()
  }

  const setSectionDuration = async (sectionId: number, minutes: number) => {
    await api.updateSection(sectionId, { estimated_duration_minutes: minutes })
    await refresh()
  }

  const deleteSection = async (sectionId: number) => {
    await api.deleteSection(sectionId)
    await refresh()
  }

  const moveSection = async (sectionId: number, direction: 'up' | 'down') => {
    if (!selectedSession) return
    const ids = selectedSession.sections.map((s) => s.id)
    const idx = ids.indexOf(sectionId)
    const swap = direction === 'up' ? idx - 1 : idx + 1
    if (idx < 0 || swap < 0 || swap >= ids.length) return
    ;[ids[idx], ids[swap]] = [ids[swap], ids[idx]]
    await api.reorderSections(selectedSession.id, ids)
    await refresh()
  }

  const addBlock = async (sectionId: number, data: StandardBlockCreate) => {
    await api.createBlock(sectionId, data)
    await refresh()
  }

  const renameBlock = async (blockId: number, name: string) => {
    await api.updateBlock(blockId, { name })
    await refresh()
  }

  const setBlockDuration = async (blockId: number, minutes: number) => {
    await api.updateBlock(blockId, { estimated_duration_minutes: minutes })
    await refresh()
  }

  const deleteBlock = async (blockId: number) => {
    await api.deleteBlock(blockId)
    await refresh()
  }

  const moveBlock = async (
    section: Section,
    blockId: number,
    direction: 'up' | 'down'
  ) => {
    const ids = section.blocks.map((b) => b.id)
    const idx = ids.indexOf(blockId)
    const swap = direction === 'up' ? idx - 1 : idx + 1
    if (idx < 0 || swap < 0 || swap >= ids.length) return
    ;[ids[idx], ids[swap]] = [ids[swap], ids[idx]]
    await api.reorderBlocks(section.id, ids)
    await refresh()
  }

  const duplicate = async () => {
    if (!template || busy) return
    setBusy(true)
    try {
      const copy = await api.duplicateTemplate(template.id, {
        copy_default_spots: true,
      })
      router.push(`/plans/${copy.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate')
      setBusy(false)
    }
  }

  const deleteTemplate = async () => {
    if (!template) return
    await api.deleteTemplate(template.id)
    router.push('/plans')
  }

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (error || !template) {
    return (
      <div className="flex items-center justify-center min-h-screen px-6">
        <div className="text-center">
          <p className="text-red-600 mb-2">{error ?? 'Plan not found'}</p>
          <button
            onClick={() => router.push('/plans')}
            className="text-primary-600 underline text-sm"
          >
            Back to plans
          </button>
        </div>
      </div>
    )
  }

  const addBlockSection = selectedSession?.sections.find(
    (s) => s.id === addBlockSectionId
  )

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto bg-white min-h-screen">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <button
            onClick={() => router.push('/plans')}
            className="text-sm text-gray-500"
          >
            ← Plans
          </button>
          <button
            onClick={() => router.push('/plans')}
            className="text-sm font-medium text-primary-600"
          >
            Done
          </button>
        </div>

        {/* Plan header */}
        <div className="px-4 pt-2 pb-3 border-b border-gray-100">
          <PlanNameField
            initial={template.name}
            onCommit={renameTemplate}
          />
          <p className="text-sm text-gray-500 mt-1">
            {instrument?.name ?? 'Instrument'} ·{' '}
            {sessionCount === 1
              ? '1 session'
              : `${sessionCount}-session rotation`}
          </p>

          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setActive(!template.is_active)}
              className={`px-3 py-1 rounded-full text-xs border ${
                template.is_active
                  ? 'bg-teal-100 border-teal-300 text-teal-700'
                  : 'bg-white border-gray-200 text-gray-600'
              }`}
            >
              {template.is_active ? 'Active plan ✓' : 'Set as active'}
            </button>
            <button
              onClick={duplicate}
              disabled={busy}
              className="px-3 py-1 rounded-full text-xs border bg-white border-gray-200 text-gray-600 disabled:opacity-50"
            >
              Duplicate
            </button>
            <button
              onClick={() =>
                setConfirmDelete({
                  kind: 'template',
                  id: template.id,
                  label: template.name,
                })
              }
              className="px-3 py-1 rounded-full text-xs border bg-white border-gray-200 text-red-600"
            >
              Delete
            </button>
          </div>
        </div>

        {/* Session tabs */}
        <div className="px-4 pt-3">
          <SessionTabs
            sessions={template.sessions}
            selectedSessionId={selectedSession?.id ?? null}
            onSelect={setSelectedSessionId}
            onAdd={addSession}
            addDisabled={busy}
          />
        </div>

        {/* Session body */}
        {selectedSession && (
          <div className="px-4 pt-2 pb-6">
            <SessionFocusField
              key={selectedSession.id}
              initial={selectedSession.focus_description ?? ''}
              onCommit={(value) => updateSessionFocus(selectedSession.id, value)}
            />

            <SessionRenameRow
              key={`rename-${selectedSession.id}`}
              session={selectedSession}
              canDelete={template.sessions.length > 1}
              onRename={(name) => renameSession(selectedSession.id, name)}
              onDelete={() =>
                setConfirmDelete({
                  kind: 'session',
                  id: selectedSession.id,
                  label: selectedSession.name,
                })
              }
            />

            {/* Sections */}
            {selectedSession.sections.length === 0 ? (
              <p className="text-sm text-gray-400 italic mt-4 mb-2">
                No sections yet.
              </p>
            ) : (
              <div className="mt-3">
                {selectedSession.sections.map((section, i) => (
                  <SectionCard
                    key={section.id}
                    section={section}
                    isFirst={i === 0}
                    isLast={i === selectedSession.sections.length - 1}
                    onMove={(dir) => moveSection(section.id, dir)}
                    onRename={(name) => renameSection(section.id, name)}
                    onDurationChange={(min) =>
                      setSectionDuration(section.id, min)
                    }
                    onDelete={() =>
                      setConfirmDelete({
                        kind: 'section',
                        id: section.id,
                        label: section.name,
                      })
                    }
                    onAddBlock={() => setAddBlockSectionId(section.id)}
                    onMoveBlock={(blockId, dir) =>
                      moveBlock(section, blockId, dir)
                    }
                    onRenameBlock={renameBlock}
                    onChangeBlockDuration={setBlockDuration}
                    onDeleteBlock={(blockId) => {
                      const block = section.blocks.find(
                        (b) => b.id === blockId
                      )
                      setConfirmDelete({
                        kind: 'block',
                        id: blockId,
                        label: block?.name ?? block?.piece_name ?? 'block',
                      })
                    }}
                  />
                ))}
              </div>
            )}

            <button
              onClick={addSection}
              className="w-full mt-2 py-3 text-sm text-gray-500 border border-dashed border-gray-300 rounded-xl hover:border-primary-300 hover:text-primary-600"
            >
              + Add section
            </button>
          </div>
        )}

        {/* Add-block sheet */}
        {addBlockSection && instrument && (
          <AddBlockSheet
            sectionName={addBlockSection.name}
            instrumentName={instrument.name}
            instrumentId={instrument.id}
            onAdd={(data) => addBlock(addBlockSection.id, data)}
            onClose={() => setAddBlockSectionId(null)}
          />
        )}

        {/* Confirm delete */}
        {confirmDelete && (
          <ConfirmDialog
            title={`Delete ${confirmDelete.kind}?`}
            message={`"${confirmDelete.label}" will be removed.`}
            confirmLabel="Delete"
            confirmVariant="danger"
            onCancel={() => setConfirmDelete(null)}
            onConfirm={async () => {
              const c = confirmDelete
              setConfirmDelete(null)
              if (c.kind === 'template') await deleteTemplate()
              else if (c.kind === 'session') await deleteSession(c.id)
              else if (c.kind === 'section') await deleteSection(c.id)
              else if (c.kind === 'block') await deleteBlock(c.id)
            }}
          />
        )}
      </div>
    </main>
  )
}

// ---------------------------------------------------------------------------
// Inline subcomponents
// ---------------------------------------------------------------------------

function PlanNameField({
  initial,
  onCommit,
}: {
  initial: string
  onCommit: (value: string) => void | Promise<void>
}) {
  const [value, setValue] = useState(initial)
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        const trimmed = value.trim()
        if (trimmed && trimmed !== initial) onCommit(trimmed)
        else if (!trimmed) setValue(initial)
      }}
      placeholder="Plan name"
      className="w-full text-xl font-semibold text-gray-900 bg-transparent placeholder-gray-300 focus:outline-none"
    />
  )
}

function SessionFocusField({
  initial,
  onCommit,
}: {
  initial: string
  onCommit: (value: string) => void | Promise<void>
}) {
  const [value, setValue] = useState(initial)
  return (
    <div className="mt-3">
      <label className="block text-xs text-gray-500 mb-1">
        Session focus (shown on Today tab)
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          if (value !== initial) onCommit(value)
        }}
        placeholder="e.g. Intonation and bow control"
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary-300"
      />
    </div>
  )
}

function SessionRenameRow({
  session,
  canDelete,
  onRename,
  onDelete,
}: {
  session: TemplateSession
  canDelete: boolean
  onRename: (name: string) => void | Promise<void>
  onDelete: () => void
}) {
  const [name, setName] = useState(session.name)
  return (
    <div className="mt-3 flex items-center gap-2">
      <label className="block text-xs text-gray-500 shrink-0">Name</label>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          const trimmed = name.trim()
          if (trimmed && trimmed !== session.name) onRename(trimmed)
          else if (!trimmed) setName(session.name)
        }}
        className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary-300"
      />
      {canDelete && (
        <button
          onClick={onDelete}
          className="shrink-0 px-2 py-1 text-xs text-red-500"
        >
          Delete session
        </button>
      )}
    </div>
  )
}

