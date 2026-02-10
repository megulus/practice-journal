'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useApi } from '@/lib/useApi'
import type { UserInstrument, PracticeTemplate, BlockType, PracticeDay } from '@/lib/types'
import DaySelector from '@/components/DaySelector'
import EditableText from '@/components/builder/EditableText'
import BlockEditor from '@/components/builder/BlockEditor'
import AddBlockPanel from '@/components/builder/AddBlockPanel'
import TemplatePicker from '@/components/builder/TemplatePicker'
import ConfirmDialog from '@/components/ConfirmDialog'

export default function TemplateEditPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const api = useApi()
  const instrumentName = params.instrument as string
  const templateIdParam = searchParams.get('templateId')

  const [userInstrument, setUserInstrument] = useState<UserInstrument | null>(null)
  const [template, setTemplate] = useState<PracticeTemplate | null>(null)
  const [templates, setTemplates] = useState<PracticeTemplate[]>([])
  const [blockTypes, setBlockTypes] = useState<BlockType[]>([])
  const [selectedDay, setSelectedDay] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [confirmDeleteTemplate, setConfirmDeleteTemplate] = useState(false)

  const clearError = () => setError('')

  const refreshTemplateList = useCallback(
    async (ui: UserInstrument) => {
      try {
        const allTemplates = await api.getTemplates(ui.id, true)
        setTemplates(allTemplates)
      } catch (e) {
        console.error(e)
      }
    },
    [api]
  )

  const refreshTemplate = useCallback(
    async (id: number) => {
      try {
        const tmpl = await api.getTemplate(id)
        setTemplate(tmpl)
        clearError()
      } catch (e) {
        setError('Failed to refresh template.')
        console.error(e)
      }
    },
    [api]
  )

  // Initial data load
  useEffect(() => {
    setLoading(true)
    Promise.all([api.getUserInstruments(), api.getBlockTypes()])
      .then(async ([userInstruments, bt]) => {
        setBlockTypes(bt)
        const ui = userInstruments.find(
          (ui) => ui.instrument.name.toLowerCase() === instrumentName.toLowerCase()
        )
        if (!ui) {
          setLoading(false)
          return
        }
        setUserInstrument(ui)
        const allTemplates = await api.getTemplates(ui.id, true)
        setTemplates(allTemplates)

        if (templateIdParam) {
          const tmpl = await api.getTemplate(Number(templateIdParam))
          setTemplate(tmpl)
        }
        setLoading(false)
      })
      .catch((err) => {
        console.error(err)
        setError('Failed to load data.')
        setLoading(false)
      })
  }, [instrumentName, templateIdParam, api])

  function handleSelectTemplate(templateId: number) {
    router.push(`/${instrumentName}/template/edit?templateId=${templateId}`)
  }

  async function handleDeleteTemplate(templateId: number) {
    try {
      await api.deleteTemplate(templateId)
      if (template?.id === templateId) {
        setTemplate(null)
        router.push(`/${instrumentName}/template/edit`)
      }
      if (userInstrument) await refreshTemplateList(userInstrument)
    } catch (e) {
      setError('Failed to delete template.')
      console.error(e)
    }
  }

  async function handleArchiveTemplate(templateId: number) {
    try {
      await api.updateTemplate(templateId, { is_active: false })
      if (template?.id === templateId) {
        setTemplate(null)
        router.push(`/${instrumentName}/template/edit`)
      }
      if (userInstrument) await refreshTemplateList(userInstrument)
    } catch (e) {
      setError('Failed to archive template.')
      console.error(e)
    }
  }

  async function handleUnarchiveTemplate(templateId: number) {
    try {
      await api.updateTemplate(templateId, { is_active: true })
      if (userInstrument) await refreshTemplateList(userInstrument)
    } catch (e) {
      setError('Failed to unarchive template.')
      console.error(e)
    }
  }

  async function handleUpdateTemplateName(newName: string) {
    if (!template) return
    try {
      await api.updateTemplate(template.id, { name: newName })
      await refreshTemplate(template.id)
    } catch (e) {
      setError('Failed to update template name.')
      console.error(e)
    }
  }

  async function handleChangeDaysCount(delta: number) {
    if (!template) return
    const newCount = template.days_count + delta
    if (newCount < 1) return
    try {
      await api.updateTemplate(template.id, { days_count: newCount })
      if (selectedDay > newCount) {
        setSelectedDay(newCount)
      }
      await refreshTemplate(template.id)
    } catch (e) {
      setError('Failed to update days count.')
      console.error(e)
    }
  }

  async function handleUpdateDayTitle(newTitle: string) {
    if (!template) return
    try {
      await api.updateDay(template.id, selectedDay, { title: newTitle })
      await refreshTemplate(template.id)
    } catch (e) {
      setError('Failed to update day title.')
      console.error(e)
    }
  }

  async function handleAddBlock(blockTypeId: number) {
    if (!template) return
    const bt = blockTypes.find((b) => b.id === blockTypeId)
    try {
      await api.createBlock(template.id, selectedDay, {
        block_type_id: blockTypeId,
        duration_minutes: bt?.default_duration_minutes,
      })
      await refreshTemplate(template.id)
    } catch (e) {
      setError('Failed to add block.')
      console.error(e)
    }
  }

  async function handleDeleteBlock(blockId: number) {
    if (!template) return
    try {
      await api.deleteBlock(template.id, selectedDay, blockId)
      await refreshTemplate(template.id)
    } catch (e) {
      setError('Failed to delete block.')
      console.error(e)
    }
  }

  // TODO: These handlers close over `selectedDay` at call time. If the user
  // switches days while an API call is in flight, the request uses the old day
  // but refreshTemplate still fetches the correct template. Low risk for now.
  async function handleUpdateBlockDuration(blockId: number, minutes: number) {
    if (!template) return
    try {
      await api.updateBlock(template.id, selectedDay, blockId, { duration_minutes: minutes })
      await refreshTemplate(template.id)
    } catch (e) {
      setError('Failed to update block duration.')
      console.error(e)
    }
  }

  async function handleAddExercise(blockId: number, text: string) {
    if (!template) return
    try {
      await api.createExercise(template.id, selectedDay, blockId, { exercise_text: text })
      await refreshTemplate(template.id)
    } catch (e) {
      setError('Failed to add exercise.')
      console.error(e)
    }
  }

  async function handleUpdateExercise(blockId: number, exerciseId: number, text: string) {
    if (!template) return
    try {
      await api.updateExercise(template.id, selectedDay, blockId, exerciseId, {
        exercise_text: text,
      })
      await refreshTemplate(template.id)
    } catch (e) {
      setError('Failed to update exercise.')
      console.error(e)
    }
  }

  async function handleDeleteExercise(blockId: number, exerciseId: number) {
    if (!template) return
    try {
      await api.deleteExercise(template.id, selectedDay, blockId, exerciseId)
      await refreshTemplate(template.id)
    } catch (e) {
      setError('Failed to delete exercise.')
      console.error(e)
    }
  }

  async function handleCreateTemplate(data: { name: string; daysCount: number; description?: string }): Promise<number> {
    if (!userInstrument) throw new Error('No instrument loaded')
    try {
      const tmpl = await api.createTemplate({
        user_instrument_id: userInstrument.id,
        name: data.name,
        days_count: data.daysCount,
        description: data.description,
      })
      await refreshTemplateList(userInstrument)
      return tmpl.id
    } catch (e) {
      setError('Failed to create template.')
      console.error(e)
      throw e
    }
  }

  async function handleMoveBlock(currentIndex: number, direction: 'up' | 'down') {
    if (!template) return
    const dayData = template.practice_days?.find((d) => d.day_number === selectedDay)
    if (!dayData) return

    const blocks = [...dayData.exercise_blocks].sort(
      (a, b) => a.display_order - b.display_order
    )
    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (swapIndex < 0 || swapIndex >= blocks.length) return

    const ids = blocks.map((b) => b.id)
    ;[ids[currentIndex], ids[swapIndex]] = [ids[swapIndex], ids[currentIndex]]

    try {
      await api.reorderBlocks(template.id, selectedDay, { block_ids: ids })
      await refreshTemplate(template.id)
    } catch (e) {
      setError('Failed to reorder blocks.')
      console.error(e)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-primary-100 to-secondary-100 p-8">
        <div className="max-w-6xl mx-auto">
          <p className="text-center text-gray-600">Loading...</p>
        </div>
      </main>
    )
  }

  if (!userInstrument) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-primary-100 to-secondary-100 p-8">
        <div className="max-w-6xl mx-auto">
          <p className="text-center text-red-600">Instrument not found</p>
        </div>
      </main>
    )
  }

  // No templateId — show picker
  if (!template) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-primary-100 to-secondary-100 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-xl overflow-hidden">
            <div className="bg-gradient-to-br from-primary-500 to-primary-700 text-white p-8 text-center">
              <h1 className="text-3xl font-bold">Template Builder</h1>
              <p className="text-primary-100 mt-1">{userInstrument.instrument.name}</p>
            </div>
            <div className="p-8">
              <TemplatePicker
                templates={templates}
                onCreateTemplate={handleCreateTemplate}
                onSelect={handleSelectTemplate}
                onDelete={handleDeleteTemplate}
                onArchive={handleArchiveTemplate}
                onUnarchive={handleUnarchiveTemplate}
                showArchived={showArchived}
                onToggleShowArchived={() => setShowArchived((v) => !v)}
              />
            </div>
          </div>
        </div>
      </main>
    )
  }

  // Builder view
  const currentDay: PracticeDay | undefined = template.practice_days?.find(
    (d) => d.day_number === selectedDay
  )
  const sortedBlocks = currentDay
    ? [...currentDay.exercise_blocks].sort((a, b) => a.display_order - b.display_order)
    : []

  return (
    <main className="min-h-screen bg-gradient-to-br from-primary-100 to-secondary-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-br from-primary-500 to-primary-700 text-white p-8 text-center">
            <h1 className="text-3xl font-bold mb-2">Template Builder</h1>
            <EditableText
              value={template.name}
              onSave={handleUpdateTemplateName}
              className="text-xl text-primary-100"
              inputClassName="text-xl text-white text-center"
            />
            {/* Template actions in header */}
            {!template.is_system && (
              <div className="flex justify-center gap-3 mt-4">
                {template.is_active ? (
                  <button
                    onClick={() => handleArchiveTemplate(template.id)}
                    className="text-sm text-primary-200 hover:text-white flex items-center gap-1.5 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                    Archive
                  </button>
                ) : (
                  <button
                    onClick={() => handleUnarchiveTemplate(template.id)}
                    className="text-sm text-primary-200 hover:text-white flex items-center gap-1.5 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Unarchive
                  </button>
                )}
                <button
                  onClick={() => setConfirmDeleteTemplate(true)}
                  className="text-sm text-red-300 hover:text-red-100 flex items-center gap-1.5 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              </div>
            )}
          </div>

          <div className="p-8">
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg mb-6 text-red-700">
                {error}
              </div>
            )}

            {/* Days count control */}
            <div className="flex items-center gap-3 mb-6">
              <span className="text-sm font-medium text-gray-600">Days in rotation:</span>
              <button
                onClick={() => handleChangeDaysCount(-1)}
                disabled={template.days_count <= 1}
                className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full hover:bg-gray-200 disabled:opacity-30 font-bold text-gray-600"
              >
                -
              </button>
              <span className="text-lg font-semibold">{template.days_count}</span>
              <button
                onClick={() => handleChangeDaysCount(1)}
                className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full hover:bg-gray-200 font-bold text-gray-600"
              >
                +
              </button>
            </div>

            {/* Day selector */}
            <DaySelector
              daysCount={template.days_count}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
            />

            {/* Day title */}
            {currentDay && (
              <div className="mb-6">
                <span className="text-sm text-gray-500">Day title:</span>
                <div className="text-lg font-semibold text-gray-800">
                  <EditableText
                    value={currentDay.title}
                    onSave={handleUpdateDayTitle}
                    placeholder="Untitled day"
                  />
                </div>
              </div>
            )}

            {/* Blocks */}
            <div className="space-y-4">
              {sortedBlocks.map((block, index) => (
                <BlockEditor
                  key={block.id}
                  block={block}
                  blockTypes={blockTypes}
                  isFirst={index === 0}
                  isLast={index === sortedBlocks.length - 1}
                  onMoveUp={() => handleMoveBlock(index, 'up')}
                  onMoveDown={() => handleMoveBlock(index, 'down')}
                  onDelete={() => handleDeleteBlock(block.id)}
                  onUpdateDuration={handleUpdateBlockDuration}
                  onAddExercise={handleAddExercise}
                  onUpdateExercise={handleUpdateExercise}
                  onDeleteExercise={handleDeleteExercise}
                />
              ))}
            </div>

            {/* Add block panel */}
            <AddBlockPanel blockTypes={blockTypes} onAddBlock={handleAddBlock} />

            {/* Back link */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <button
                onClick={() => router.push(`/${instrumentName}/plan`)}
                className="text-primary-600 hover:text-primary-800 font-medium"
              >
                &larr; Back to Practice Plan
              </button>
            </div>
          </div>
        </div>
      </div>

      {confirmDeleteTemplate && (
        <ConfirmDialog
          title="Delete Template?"
          message={
            <p>
              This will permanently delete <strong>{template.name}</strong>. Your practice logs will be preserved.
              <br />
              <span className="text-red-600 text-sm mt-2 block">This action cannot be undone.</span>
            </p>
          }
          confirmLabel="Delete Template"
          confirmVariant="danger"
          onConfirm={() => {
            handleDeleteTemplate(template.id)
            setConfirmDeleteTemplate(false)
          }}
          onCancel={() => setConfirmDeleteTemplate(false)}
        />
      )}
    </main>
  )
}
