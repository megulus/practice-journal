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
import { AutoSaveInput, Button, Pill } from '@/components/ui'
import { getSectionColor } from '@/lib/section-colors'

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
    if (!selectedSession || busy) return
    setBusy(true)
    try {
      await api.createSection(selectedSession.id, {
        name: 'New section',
        section_type: DEFAULT_SECTION_TYPE,
        estimated_duration_minutes: 5,
      })
      await refresh()
    } finally {
      setBusy(false)
    }
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
    } finally {
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
      <div className="flex justify-center py-16 text-text-secondary">
        Loading…
      </div>
    )
  }

  if (error || !template) {
    return (
      <div className="py-16 text-center">
        <p className="mb-3 text-danger-text">{error ?? 'Plan not found'}</p>
        <Button variant="ghost" size="sm" onClick={() => router.push('/plans')}>
          Back to plans
        </Button>
      </div>
    )
  }

  const addBlockSection = selectedSession?.sections.find(
    (s) => s.id === addBlockSectionId
  )

  // Section pip colors: pinned warm-up/cool-down plus the pool by display order.
  let nonPinnedIndex = 0

  return (
    <div>
      {/* Top bar */}
      <div className="flex items-center justify-between pb-2">
        <button
          onClick={() => router.push('/plans')}
          className="text-sm text-text-secondary transition-colors hover:text-text-primary"
        >
          ← Plans
        </button>
        <button
          onClick={() => router.push('/plans')}
          className="text-sm font-medium text-text-link transition-colors hover:text-text-primary"
        >
          Done
        </button>
      </div>

      {/* Plan header */}
      <div className="border-b border-border-default pb-3">
        <PlanNameField initial={template.name} onCommit={renameTemplate} />
        <p className="mt-1 text-sm text-text-secondary">
          {instrument?.name ?? 'Instrument'} ·{' '}
          {sessionCount === 1 ? '1 session' : `${sessionCount}-session rotation`}
        </p>

        <div className="mt-3 flex items-center gap-2">
          <Pill
            variant="instrument"
            active={template.is_active}
            onClick={() => setActive(!template.is_active)}
          >
            {template.is_active ? 'Active plan' : 'Set as active'}
          </Pill>
          <Button
            variant="secondary"
            size="sm"
            onClick={duplicate}
            disabled={busy}
          >
            Duplicate
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-danger-text"
            onClick={() =>
              setConfirmDelete({
                kind: 'template',
                id: template.id,
                label: template.name,
              })
            }
          >
            Delete
          </Button>
        </div>
      </div>

      {/* Session tabs */}
      <div className="pt-3">
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
        <div className="pt-2 pb-6">
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
            <p className="mt-4 mb-2 text-sm italic text-text-tertiary">
              No sections yet.
            </p>
          ) : (
            <div className="mt-3">
              {selectedSession.sections.map((section, i) => {
                const isPinned =
                  section.section_type === 'warmup' ||
                  section.section_type === 'cooldown'
                const color = getSectionColor(
                  section.section_type,
                  isPinned ? 0 : nonPinnedIndex
                )
                if (!isPinned) nonPinnedIndex++
                return (
                  <SectionCard
                    key={section.id}
                    section={section}
                    color={color}
                    isFirst={i === 0}
                    isLast={i === selectedSession.sections.length - 1}
                    onMove={(dir) => moveSection(section.id, dir)}
                    onRename={(name) => renameSection(section.id, name)}
                    onDurationChange={(min) => setSectionDuration(section.id, min)}
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
                      const block = section.blocks.find((b) => b.id === blockId)
                      setConfirmDelete({
                        kind: 'block',
                        id: blockId,
                        label: block?.name ?? block?.piece_name ?? 'block',
                      })
                    }}
                  />
                )
              })}
            </div>
          )}

          <button
            onClick={addSection}
            className="mt-2 w-full rounded-xl border border-dashed border-border-default py-3 text-sm text-text-secondary transition-colors hover:border-border-input hover:text-text-primary"
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
  return (
    <AutoSaveInput
      value={initial}
      onCommit={onCommit}
      placeholder="Plan name"
      className="w-full bg-transparent text-xl font-semibold text-text-primary placeholder:text-text-tertiary focus:outline-none"
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
  return (
    <div className="mt-3">
      <label className="mb-1 block text-xs text-text-secondary">
        Session focus (shown on Today tab)
      </label>
      {/* Focus is optional and clearable, so don't trim or roll back on empty. */}
      <AutoSaveInput
        value={initial}
        onCommit={onCommit}
        trim={false}
        rollbackWhenEmpty={false}
        placeholder="e.g. Intonation and bow control"
        className="w-full rounded-lg border border-border-input bg-input-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-input-focus focus:outline-none"
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
  return (
    <div className="mt-3 flex items-center gap-2">
      <label className="block shrink-0 text-xs text-text-secondary">Name</label>
      <AutoSaveInput
        value={session.name}
        onCommit={onRename}
        className="flex-1 rounded-lg border border-border-input bg-input-bg px-3 py-1.5 text-sm text-text-primary focus:border-border-input-focus focus:outline-none"
      />
      {canDelete && (
        <button
          onClick={onDelete}
          className="shrink-0 px-2 py-1 text-xs text-danger-text transition-colors hover:opacity-80"
        >
          Delete session
        </button>
      )}
    </div>
  )
}

