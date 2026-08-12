'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useApi } from '@/lib/useApi'
import type {
  Instrument,
  Template,
  TemplateSession,
  Section,
  BlockCreate,
  SectionType,
} from '@/lib/types'
import SessionTabs from '@/components/SessionTabs'
import SectionCard from '@/components/SectionCard'
import AddBlockSheet from '@/components/AddBlockSheet'
import { SpotManagementDrawer } from '@/components/repertoire'
import { AutoSaveInput, Button, ConfirmDialog, Pill } from '@/components/ui'
import { cx } from '@/lib/cx'
import { getSectionColor } from '@/lib/section-colors'
import {
  alsoRemoves,
  archiveConfirmCopy,
  deleteConfirmCopy,
} from '@/lib/confirm-copy'

// TODO(#168): replace hardcoded section_type with a real picker (template
// editor + freeform session). All new sections in this PR are 'other'.
const DEFAULT_SECTION_TYPE: SectionType = 'other'

/** How long the displacement notice stays up before dismissing itself. */
const NOTICE_DISMISS_MS = 8000

/**
 * "Set as active" archives the instrument's previous active plan — an
 * instrument has one active plan at a time (#289). That's a change to a plan
 * the user isn't looking at, so name it. Reversible enough not to warrant a
 * confirm (it only flips `is_active`), so we report it after the fact instead;
 * `ConfirmDialog` stays reserved for the destructive actions of #266.
 */
function displacedNotice(name: string) {
  return `“${name}” is no longer active — an instrument has one active plan at a time.`
}

type Notice = { tone: 'info' | 'error'; text: string }

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
  const [spotDrawerBlockId, setSpotDrawerBlockId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<{
    kind: 'template' | 'session' | 'section' | 'block'
    /** UI noun for the kind — "plan", not "template". */
    noun: string
    id: number
    label: string
    /** Sentences naming what else goes with it. */
    cascade?: string[]
  } | null>(null)
  // Archiving is the `is_active` toggle. Only turning it *off* confirms —
  // activating reports what it displaced afterwards instead (see `notice`).
  const [confirmArchive, setConfirmArchive] = useState(false)
  // Feedback for the activate/archive toggle: which plan the activation
  // displaced, or why the write failed.
  const [notice, setNotice] = useState<Notice | null>(null)

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
    setNotice(null)
    try {
      const updated = await api.updateTemplate(template.id, {
        is_active: isActive,
      })
      setTemplate({ ...template, is_active: isActive })
      // Only report a displacement when the server says one happened — the
      // field is null when this plan was already active or nothing else was.
      if (updated.deactivated_template_name) {
        setNotice({
          tone: 'info',
          text: displacedNotice(updated.deactivated_template_name),
        })
      }
    } catch {
      setNotice({
        tone: 'error',
        text: isActive
          ? "Couldn't set this plan as active. Please try again."
          : "Couldn't archive this plan. Please try again.",
      })
    }
  }

  // The displacement notice dismisses itself; a failure stays up until the
  // next attempt, since it's the only trace that the toggle didn't take.
  useEffect(() => {
    if (notice?.tone !== 'info') return
    const timer = setTimeout(() => setNotice(null), NOTICE_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [notice])

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

  const addBlock = async (sectionId: number, data: BlockCreate) => {
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

  const spotDrawerBlock = selectedSession?.sections
    .flatMap((s) => s.blocks)
    .find((b) => b.id === spotDrawerBlockId)

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
            onClick={() =>
              template.is_active ? setConfirmArchive(true) : setActive(true)
            }
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
                noun: 'plan',
                id: template.id,
                label: template.name,
                cascade: [
                  // "session" is overloaded — a rotation day here, a logged
                  // practice there. Say which, then say the other survives:
                  // delete_template only soft-deletes the template row, so
                  // practice logs (and their history cards) are untouched.
                  ...(sessionCount
                    ? [
                        alsoRemoves(sessionCount, 'rotation session', {
                          andContents: true,
                        }),
                      ]
                    : []),
                  // True at any session count.
                  'Your logged practice history is kept.',
                ],
              })
            }
          >
            Delete
          </Button>
        </div>

        {/*
          Activating a plan archives the instrument's previous active one, so
          say which (#289). The live region is mounted unconditionally and only
          its contents change: a status region that arrives in the DOM already
          holding its text is announced unreliably across screen readers.
        */}
        <div role="status" aria-live="polite">
          {notice && (
            <p
              className={cx(
                'mt-lg rounded-lg bg-card-bg-inset px-lg py-md text-sm',
                notice.tone === 'error'
                  ? 'text-danger-text'
                  : 'text-text-secondary',
              )}
            >
              {notice.text}
            </p>
          )}
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
                noun: 'session',
                id: selectedSession.id,
                label: selectedSession.name,
                cascade: selectedSession.sections.length
                  ? [
                      alsoRemoves(selectedSession.sections.length, 'section', {
                        andContents: true,
                      }),
                    ]
                  : undefined,
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
                        noun: 'section',
                        id: section.id,
                        label: section.name,
                        cascade: section.blocks.length
                          ? [alsoRemoves(section.blocks.length, 'block')]
                          : undefined,
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
                      const isRepertoire = block?.piece_id != null
                      const spotCount = block?.default_spots?.length ?? 0
                      setConfirmDelete({
                        kind: 'block',
                        // A repertoire block is the piece's slot in this plan,
                        // not the piece. Deleting it drops the block row and
                        // its default-spot links; the piece and its spots stay
                        // in the library. Say so — "delete the block Bach
                        // Partita" otherwise reads like the piece is going.
                        noun: isRepertoire ? 'repertoire block' : 'block',
                        id: blockId,
                        label: block?.name ?? block?.piece_name ?? 'block',
                        cascade: isRepertoire
                          ? [
                              ...(spotCount
                                ? [alsoRemoves(spotCount, 'default spot')]
                                : []),
                              'The piece and its spots stay in your repertoire.',
                            ]
                          : undefined,
                      })
                    }}
                    onOpenBlockSpots={setSpotDrawerBlockId}
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
          instrumentCategory={instrument.instrument_category}
          instrumentId={instrument.id}
          onAdd={(data) => addBlock(addBlockSection.id, data)}
          onClose={() => setAddBlockSectionId(null)}
        />
      )}

      {/* Spot management drawer (repertoire blocks) */}
      {spotDrawerBlock?.piece_id != null && (
        <SpotManagementDrawer
          key={spotDrawerBlock.id}
          blockId={spotDrawerBlock.id}
          pieceId={spotDrawerBlock.piece_id}
          pieceName={spotDrawerBlock.piece_name ?? 'Piece'}
          defaultSpots={spotDrawerBlock.default_spots ?? []}
          onChange={refresh}
          onClose={() => setSpotDrawerBlockId(null)}
        />
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <ConfirmDialog
          {...deleteConfirmCopy(confirmDelete.noun, confirmDelete.label, {
            cascade: confirmDelete.cascade,
          })}
          confirmLabel="Delete"
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

      {/* Confirm archive (deactivate) */}
      {confirmArchive && (
        <ConfirmDialog
          {...archiveConfirmCopy('plan', template.name, {
            cascade: [
              'It moves to Archived on the Plans list and stops being offered on Today.',
            ],
          })}
          confirmLabel="Archive"
          confirmVariant="default"
          onCancel={() => setConfirmArchive(false)}
          onConfirm={async () => {
            setConfirmArchive(false)
            await setActive(false)
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

