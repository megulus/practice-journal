'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useApi } from '@/lib/useApi'
import type { Instrument, PracticeTemplate, BlockType, PracticeDay } from '@/lib/types'
import DaySelector from '@/components/DaySelector'
import EditableText from '@/components/builder/EditableText'
import BlockEditor from '@/components/builder/BlockEditor'
import AddBlockPanel from '@/components/builder/AddBlockPanel'
import TemplatePicker from '@/components/builder/TemplatePicker'

export default function TemplateEditPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const api = useApi()
  const instrumentName = params.instrument as string
  const templateIdParam = searchParams.get('templateId')

  const [instrument, setInstrument] = useState<Instrument | null>(null)
  const [template, setTemplate] = useState<PracticeTemplate | null>(null)
  const [templates, setTemplates] = useState<PracticeTemplate[]>([])
  const [blockTypes, setBlockTypes] = useState<BlockType[]>([])
  const [selectedDay, setSelectedDay] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const clearError = () => setError('')

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
    Promise.all([api.getInstruments(), api.getBlockTypes(), api.getTemplates()])
      .then(([instruments, bt, allTemplates]) => {
        setBlockTypes(bt)
        const inst = instruments.find(
          (i) => i.name.toLowerCase() === instrumentName.toLowerCase()
        )
        if (!inst) {
          setLoading(false)
          return
        }
        setInstrument(inst)
        setTemplates(allTemplates.filter((t) => t.instrument_id === inst.id))

        if (templateIdParam) {
          return api.getTemplate(Number(templateIdParam)).then((tmpl) => {
            setTemplate(tmpl)
            setLoading(false)
          })
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
    const tmpl = await api.createTemplate({
      instrument_id: instrument!.id,
      name: data.name,
      days_count: data.daysCount,
      description: data.description,
    })
    return tmpl.id
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

  if (!instrument) {
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
              <p className="text-primary-100 mt-1">{instrument.name}</p>
            </div>
            <div className="p-8">
              <TemplatePicker
                templates={templates}
                onCreateTemplate={handleCreateTemplate}
                onSelect={handleSelectTemplate}
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
    </main>
  )
}
