'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useApi } from '@/lib/useApi'
import type { PracticeTemplate, PracticeDay, BlockType, Exercise } from '@/lib/types'

export default function LogPracticePage() {
  const params = useParams()
  const router = useRouter()
  const api = useApi()
  const instrumentName = params.instrument as string
  const [template, setTemplate] = useState<PracticeTemplate | null>(null)
  const [blockTypes, setBlockTypes] = useState<BlockType[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [freeformMode, setFreeformMode] = useState(false)

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    dayNumber: 1,
    duration: '',
    notes: '',
  })

  const [blockNotes, setBlockNotes] = useState<Record<number, string>>({})

  const [freeformSections, setFreeformSections] = useState<
    { label: string; content: string }[]
  >([])

  useEffect(() => {
    api.getBlockTypes().then(setBlockTypes).catch(() => {})

    Promise.all([api.getInstruments(), api.getTemplates()])
      .then(([instruments, allTemplates]) => {
        const inst = instruments.find(
          (i) => i.name.toLowerCase() === instrumentName.toLowerCase()
        )
        if (inst) {
          const tmpl = allTemplates.find(
            (t) => t.instrument_id === inst.id && t.is_active
          )
          if (tmpl) {
            return api.getTemplate(tmpl.id)
          }
        }
        return null
      })
      .then((tmpl) => {
        if (tmpl) {
          setTemplate(tmpl)
        } else {
          setFreeformMode(true)
        }
        setLoading(false)
      })
      .catch((err) => {
        console.error(err)
        setLoading(false)
      })
  }, [instrumentName, api])

  // Reset blockNotes when day changes
  useEffect(() => {
    setBlockNotes({})
  }, [formData.dayNumber])

  const getCurrentDay = (): PracticeDay | undefined => {
    return template?.practice_days?.find(
      (d) => d.day_number === formData.dayNumber
    )
  }

  const getBlockLabel = (block: { block_type: string; block_type_id?: number }) => {
    if (block.block_type_id) {
      const bt = blockTypes.find((t) => t.id === block.block_type_id)
      if (bt) return bt.label
    }
    const bt = blockTypes.find((t) => t.slug === block.block_type)
    if (bt) return bt.label
    return block.block_type
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    setSubmitting(true)

    try {
      if (freeformMode) {
        await api.createLog({
          practice_date: formData.date,
          duration_minutes: parseInt(formData.duration),
          notes: formData.notes,
          log_details: freeformSections
            .filter((s) => s.content && s.label.trim())
            .map((s) => ({
              section_type: s.label.toLowerCase().replace(/\s+/g, '-'),
              content: s.content,
            })),
        })
      } else {
        const currentDay = getCurrentDay()
        await api.createLog({
          template_id: template!.id,
          day_number: formData.dayNumber,
          practice_date: formData.date,
          duration_minutes: parseInt(formData.duration),
          notes: formData.notes,
          log_details: currentDay
            ? currentDay.exercise_blocks
                .filter((block) => blockNotes[block.id])
                .map((block) => ({
                  section_type: block.block_type,
                  content: blockNotes[block.id],
                }))
            : [],
        })
      }

      alert('Practice log saved!')
      setFormData({
        date: new Date().toISOString().split('T')[0],
        dayNumber: 1,
        duration: '',
        notes: '',
      })
      setBlockNotes({})
      setFreeformSections([])
    } catch (err) {
      console.error(err)
      alert('Error saving log')
    } finally {
      setSubmitting(false)
    }
  }

  const addFreeformSection = () => {
    setFreeformSections([...freeformSections, { label: '', content: '' }])
  }

  const removeFreeformSection = (index: number) => {
    setFreeformSections(freeformSections.filter((_, i) => i !== index))
  }

  const updateFreeformSection = (
    index: number,
    field: 'label' | 'content',
    value: string
  ) => {
    const updated = [...freeformSections]
    updated[index] = { ...updated[index], [field]: value }
    setFreeformSections(updated)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-primary-100 to-secondary-100 p-8">
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-gray-600">Loading...</p>
        </div>
      </main>
    )
  }

  const currentDay = getCurrentDay()
  const sortedBlocks = currentDay
    ? [...currentDay.exercise_blocks].sort(
        (a, b) => a.display_order - b.display_order
      )
    : []

  return (
    <main className="min-h-screen bg-gradient-to-br from-primary-100 to-secondary-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-br from-green-500 to-green-700 text-white p-8 text-center">
            <h1 className="text-4xl font-bold mb-2">Log Practice</h1>
            <p className="text-green-100 text-lg">Record today&apos;s session</p>
          </div>

          <form onSubmit={handleSubmit} className="p-8">
            {/* Mode toggle */}
            {template && (
              <div className="mb-6 text-center">
                <button
                  type="button"
                  onClick={() => setFreeformMode(!freeformMode)}
                  className="text-primary-600 hover:text-primary-800 underline text-sm"
                >
                  {freeformMode
                    ? 'Use template'
                    : 'Log without template'}
                </button>
              </div>
            )}

            {/* Date */}
            <div className="mb-6">
              <label className="block font-semibold text-gray-700 mb-2">Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData({ ...formData, date: e.target.value })
                }
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-500 focus:outline-none"
                required
              />
            </div>

            {/* Day selector (template mode only) */}
            {!freeformMode && template && (
              <div className="mb-6">
                <label className="block font-semibold text-gray-700 mb-2">
                  Rotation Day (1-{template.days_count})
                </label>
                <select
                  value={formData.dayNumber}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setFormData({
                      ...formData,
                      dayNumber: parseInt(e.target.value),
                    })
                  }
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-500 focus:outline-none"
                  required
                >
                  {Array.from(
                    { length: template.days_count },
                    (_, i) => i + 1
                  ).map((day) => {
                    const dayData = template.practice_days?.find(
                      (d: PracticeDay) => d.day_number === day
                    )
                    return (
                      <option key={day} value={day}>
                        Day {day}
                        {dayData ? `: ${dayData.title}` : ''}
                      </option>
                    )
                  })}
                </select>
              </div>
            )}

            {/* Duration */}
            <div className="mb-6">
              <label className="block font-semibold text-gray-700 mb-2">
                Practice Duration (minutes)
              </label>
              <input
                type="number"
                value={formData.duration}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData({ ...formData, duration: e.target.value })
                }
                placeholder="e.g., 45"
                min="1"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-500 focus:outline-none"
                required
              />
            </div>

            {/* Template-based block sections */}
            {!freeformMode && sortedBlocks.map((block) => (
              <div key={block.id} className="mb-6">
                <label className="block font-semibold text-gray-700 mb-2">
                  {getBlockLabel(block)}
                  {block.duration_minutes && (
                    <span className="ml-2 text-sm font-normal text-gray-500">
                      ({block.duration_minutes} min)
                    </span>
                  )}
                </label>

                {block.exercises.length > 0 ? (
                  <select
                    value={blockNotes[block.id] || ''}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                      setBlockNotes({
                        ...blockNotes,
                        [block.id]: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-500 focus:outline-none"
                  >
                    <option value="">Select exercise...</option>
                    {[...block.exercises]
                      .sort(
                        (a: Exercise, b: Exercise) =>
                          a.display_order - b.display_order
                      )
                      .map((ex: Exercise) => (
                        <option key={ex.id} value={ex.exercise_text}>
                          {ex.exercise_text}
                        </option>
                      ))}
                  </select>
                ) : (
                  <textarea
                    value={blockNotes[block.id] || ''}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setBlockNotes({
                        ...blockNotes,
                        [block.id]: e.target.value,
                      })
                    }
                    placeholder={`What did you work on for ${getBlockLabel(block).toLowerCase()}?`}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-500 focus:outline-none resize-y min-h-[100px]"
                  />
                )}
              </div>
            ))}

            {/* Freeform sections */}
            {freeformMode && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-700">Sections</h3>
                  <button
                    type="button"
                    onClick={addFreeformSection}
                    className="px-3 py-1 text-sm bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 transition-colors"
                  >
                    + Add section
                  </button>
                </div>

                {freeformSections.length === 0 && (
                  <p className="text-gray-400 italic text-sm mb-4">
                    No sections added. Click &quot;Add section&quot; to log
                    specific areas of practice.
                  </p>
                )}

                {freeformSections.map((section, index) => (
                  <div
                    key={index}
                    className="border border-gray-200 rounded-lg p-4 mb-4"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="text"
                        value={section.label}
                        onChange={(e) =>
                          updateFreeformSection(index, 'label', e.target.value)
                        }
                        placeholder="Section name (e.g., Warm-up, Scales)"
                        className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-primary-500 focus:outline-none text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => removeFreeformSection(index)}
                        className="text-red-400 hover:text-red-600 px-2 py-1 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                    <textarea
                      value={section.content}
                      onChange={(e) =>
                        updateFreeformSection(index, 'content', e.target.value)
                      }
                      placeholder="What did you work on?"
                      className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-primary-500 focus:outline-none resize-y min-h-[80px] text-sm"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Notes */}
            <div className="mb-6">
              <label className="block font-semibold text-gray-700 mb-2">
                Notes &amp; Observations
              </label>
              <textarea
                value={formData.notes}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Breakthroughs, challenges, things to remember for next time..."
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-500 focus:outline-none resize-y min-h-[100px]"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-green-500 text-white py-4 rounded-lg font-semibold text-lg hover:bg-green-600 transition-all disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {submitting ? 'Saving...' : 'Save Practice Log'}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
