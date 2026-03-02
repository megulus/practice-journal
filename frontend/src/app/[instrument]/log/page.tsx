'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useApi } from '@/lib/useApi'
import OutcomeSelector from '@/components/OutcomeSelector'
import SuggestionCard from '@/components/SuggestionCard'
import Combobox from '@/components/Combobox'
import SectionDetailFields from '@/components/SectionDetailFields'
import { evaluateRules } from '@/lib/progressionRules'
import type { PracticeTemplate, PracticeDay, BlockType, Exercise, PracticeOutcome, Suggestion, UserInstrument } from '@/lib/types'

// Track exercise selection with outcome
interface ExerciseSelection {
  exerciseId: number
  exerciseText: string
  outcome?: PracticeOutcome
  tempoPracticed?: number
}

export default function LogPracticePage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const api = useApi()
  const instrumentName = params.instrument as string
  const urlParamsApplied = useRef(false)
  const skipNextReset = useRef(false)
  const singleBlockMode = useRef(false)
  const [userInstrument, setUserInstrument] = useState<UserInstrument | null>(null)
  const [template, setTemplate] = useState<PracticeTemplate | null>(null)
  const [blockTypes, setBlockTypes] = useState<BlockType[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [freeformMode, setFreeformMode] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set())

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    dayNumber: 1,
    duration: '',
    notes: '',
  })

  // Track exercise selections with outcomes (keyed by block id)
  const [exerciseSelections, setExerciseSelections] = useState<Record<number, ExerciseSelection>>({})
  const [blockNotes, setBlockNotes] = useState<Record<number, string>>({})
  const [dismissedBlocks, setDismissedBlocks] = useState<Set<number>>(new Set())

  const [freeformSections, setFreeformSections] = useState<
    { label: string; content: string; duration_minutes?: number; tempo_practiced?: number; key_practiced?: string; time_signature?: string; outcome?: PracticeOutcome }[]
  >([])
  const [sectionSuggestions, setSectionSuggestions] = useState<string[]>([])

  // Save-as-template state
  const [submittedFreeformSections, setSubmittedFreeformSections] = useState<
    typeof freeformSections
  >([])
  const [submittedInFreeformMode, setSubmittedInFreeformMode] = useState(false)
  const [showSaveAsTemplate, setShowSaveAsTemplate] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [savedTemplateId, setSavedTemplateId] = useState<number | null>(null)

  useEffect(() => {
    // Fetch block types and section type suggestions, then merge for combobox
    Promise.all([
      api.getBlockTypes().then((bts) => { setBlockTypes(bts); return bts }),
      api.getSectionTypes().catch(() => [] as string[]),
    ]).then(([bts, pastSections]) => {
      const labels = bts.map((bt) => bt.label)
      const seen = new Set([
        ...labels.map((l) => l.toLowerCase()),
        ...bts.map((bt) => bt.slug.toLowerCase()),
      ])
      for (const s of pastSections) {
        if (!seen.has(s.toLowerCase())) {
          labels.push(s)
          seen.add(s.toLowerCase())
        }
      }
      labels.sort((a, b) => a.localeCompare(b))
      setSectionSuggestions(labels)
    }).catch(() => {})

    api.getUserInstruments()
      .then(async (userInstruments) => {
        const ui = userInstruments.find(
          (ui) => ui.instrument.name.toLowerCase() === instrumentName.toLowerCase()
        )
        if (ui) {
          setUserInstrument(ui)
          const allTemplates = await api.getTemplates(ui.id)
          const tmpl = allTemplates.find((t) => t.is_active)
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

  // Handle URL params after template loads (one-time)
  useEffect(() => {
    if (!template || urlParamsApplied.current) return
    const dayParam = searchParams.get('day')
    if (!dayParam) {
      urlParamsApplied.current = true
      return
    }

    urlParamsApplied.current = true
    const dayNum = parseInt(dayParam)
    if (dayNum < 1 || dayNum > template.days_count) return

    const blockIdParam = searchParams.get('blockId')
    const dayData = template.practice_days?.find((d) => d.day_number === dayNum)

    if (blockIdParam && dayData) {
      const targetBlockId = parseInt(blockIdParam)
      const otherBlockIds = dayData.exercise_blocks
        .filter((b) => b.id !== targetBlockId)
        .map((b) => b.id)
      const targetBlock = dayData.exercise_blocks.find((b) => b.id === targetBlockId)

      // Track single-block mode for auto-return after save
      singleBlockMode.current = true

      // Set day, dismiss other blocks, and pre-fill duration together
      skipNextReset.current = true
      setFormData((prev) => ({
        ...prev,
        dayNumber: dayNum,
        duration: targetBlock?.duration_minutes ? String(targetBlock.duration_minutes) : prev.duration,
      }))
      setDismissedBlocks(new Set(otherBlockIds))
    } else {
      setFormData((prev) => ({ ...prev, dayNumber: dayNum }))
    }
  }, [template, searchParams])

  // Reset selections when day changes (skipped for URL-param-driven change with blockId)
  useEffect(() => {
    if (skipNextReset.current) {
      skipNextReset.current = false
      return
    }
    setBlockNotes({})
    setExerciseSelections({})
    setDismissedBlocks(new Set())
  }, [formData.dayNumber])

  const getCurrentDay = (): PracticeDay | undefined => {
    return template?.practice_days?.find(
      (d) => d.day_number === formData.dayNumber
    )
  }

  const getContentPlaceholder = (label: string): string => {
    const l = label.toLowerCase()
    if (l.includes('warm') || l.includes('cool'))
      return 'Exercises, stretches, long tones...'
    if (l.includes('scale') || l.includes('arpeggio'))
      return 'Keys, patterns, thirds/sixths...'
    if (l.includes('repertoire'))
      return 'Piece, movement, measures...'
    if (l.includes('technique') || l.includes('etude'))
      return 'Etude, exercise name, passage...'
    if (l.includes('sight'))
      return 'What did you sight-read?'
    return 'What did you work on?'
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

  const handleExerciseSelect = (blockId: number, exercise: Exercise | null) => {
    if (!exercise) {
      const { [blockId]: _, ...rest } = exerciseSelections
      setExerciseSelections(rest)
      return
    }
    setExerciseSelections({
      ...exerciseSelections,
      [blockId]: {
        exerciseId: exercise.id,
        exerciseText: exercise.exercise_text,
        tempoPracticed: exercise.tempo_bpm,
        outcome: exerciseSelections[blockId]?.outcome,
      },
    })
  }

  const handleOutcomeChange = (blockId: number, outcome: PracticeOutcome | undefined) => {
    if (!exerciseSelections[blockId]) return
    setExerciseSelections({
      ...exerciseSelections,
      [blockId]: {
        ...exerciseSelections[blockId],
        outcome,
      },
    })
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
              duration_minutes: s.duration_minutes,
              tempo_practiced: s.tempo_practiced,
              key_practiced: s.key_practiced,
              time_signature: s.time_signature,
              outcome: s.outcome,
            })),
        })
      } else {
        const currentDay = getCurrentDay()
        // Build log details with exercise outcomes
        const logDetails = currentDay
          ? currentDay.exercise_blocks
              .filter((block) => exerciseSelections[block.id] || blockNotes[block.id])
              .map((block) => {
                const selection = exerciseSelections[block.id]
                if (selection) {
                  return {
                    section_type: block.block_type,
                    content: selection.exerciseText,
                    exercise_id: selection.exerciseId,
                    tempo_practiced: selection.tempoPracticed,
                    outcome: selection.outcome,
                  }
                }
                return {
                  section_type: block.block_type,
                  content: blockNotes[block.id],
                }
              })
          : []

        const freeformDetails = freeformSections
          .filter((s) => s.content && s.label.trim())
          .map((s) => ({
            section_type: s.label.toLowerCase().replace(/\s+/g, '-'),
            content: s.content,
            duration_minutes: s.duration_minutes,
            tempo_practiced: s.tempo_practiced,
            key_practiced: s.key_practiced,
            time_signature: s.time_signature,
            outcome: s.outcome,
          }))

        await api.createLog({
          template_id: template!.id,
          day_number: formData.dayNumber,
          practice_date: formData.date,
          duration_minutes: parseInt(formData.duration),
          notes: formData.notes,
          log_details: [...logDetails, ...freeformDetails],
        })
      }

      // In single-block mode, return to plan page instead of showing success screen
      if (singleBlockMode.current) {
        router.push(`/${instrumentName}/plan?logged=${Date.now()}`)
        return
      }

      // Fetch suggestions after logging
      if (userInstrument) {
        try {
          const progressData = await api.getSuggestionsProgress(userInstrument.instrument.id)
          const newSuggestions = evaluateRules(
            progressData.exercises,
            progressData.progress,
            dismissedKeys
          )
          setSuggestions(newSuggestions)
        } catch (err) {
          console.error('Failed to fetch suggestions:', err)
        }
      }

      // Preserve freeform sections for save-as-template prompt
      setSubmittedFreeformSections(
        freeformSections.filter((s) => s.content && s.label.trim())
      )
      setSubmittedInFreeformMode(freeformMode)

      setShowSuccess(true)
      setFormData({
        date: new Date().toISOString().split('T')[0],
        dayNumber: 1,
        duration: '',
        notes: '',
      })
      setBlockNotes({})
      setExerciseSelections({})
      setDismissedBlocks(new Set())
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

  const moveFreeformSection = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1
    if (target < 0 || target >= freeformSections.length) return
    const updated = [...freeformSections]
    ;[updated[index], updated[target]] = [updated[target], updated[index]]
    setFreeformSections(updated)
  }

  const handleAcceptSuggestion = async (suggestion: Suggestion) => {
    if (!suggestion.action) return
    try {
      await api.acceptSuggestion(suggestion.key, suggestion.action)
      setSuggestions(suggestions.filter((s) => s.key !== suggestion.key))
      setDismissedKeys(new Set([...dismissedKeys, suggestion.key]))
    } catch (err) {
      console.error('Failed to accept suggestion:', err)
    }
  }

  const handleDismissSuggestion = async (suggestion: Suggestion) => {
    try {
      await api.dismissSuggestion(suggestion.key)
      setSuggestions(suggestions.filter((s) => s.key !== suggestion.key))
      setDismissedKeys(new Set([...dismissedKeys, suggestion.key]))
    } catch (err) {
      console.error('Failed to dismiss suggestion:', err)
    }
  }

  const handleNotYet = (suggestion: Suggestion) => {
    // Remove from current view but don't dismiss permanently
    setSuggestions(suggestions.filter((s) => s.key !== suggestion.key))
  }

  const handleSaveAsTemplate = async () => {
    if (!userInstrument || !templateName.trim()) return
    setSavingTemplate(true)
    try {
      const newTemplate = await api.createTemplate({
        user_instrument_id: userInstrument.id,
        name: templateName.trim(),
        days_count: 1,
      })

      for (let i = 0; i < submittedFreeformSections.length; i++) {
        const section = submittedFreeformSections[i]
        // Match section label to a block type by label or slug; fall back to "technique"
        const matchedType = blockTypes.find(
          (bt) =>
            bt.label.toLowerCase() === section.label.toLowerCase() ||
            bt.slug.toLowerCase() === section.label.toLowerCase().replace(/\s+/g, '-')
        )
        const fallbackType = blockTypes.find((bt) => bt.slug === 'technique')
        const blockTypeId = matchedType?.id ?? fallbackType?.id ?? blockTypes[0]?.id

        const block = await api.createBlock(newTemplate.id, 1, {
          block_type_id: blockTypeId,
          duration_minutes: section.duration_minutes,
          display_order: i + 1,
        })

        await api.createExercise(newTemplate.id, 1, block.id, {
          exercise_text: section.content,
          tempo_bpm: section.tempo_practiced,
          key: section.key_practiced,
          display_order: 1,
        })
      }

      setSavedTemplateId(newTemplate.id)
    } catch (err) {
      console.error('Failed to save template:', err)
      alert('Error saving template')
    } finally {
      setSavingTemplate(false)
    }
  }

  const handleLogAnother = () => {
    setShowSuccess(false)
    setSuggestions([])
    setSubmittedFreeformSections([])
    setSubmittedInFreeformMode(false)
    setShowSaveAsTemplate(false)
    setTemplateName('')
    setSavingTemplate(false)
    setSavedTemplateId(null)
  }

  const updateFreeformSection = (
    index: number,
    field: 'label' | 'content' | 'duration_minutes' | 'tempo_practiced' | 'key_practiced' | 'time_signature' | 'outcome',
    value: string | number | undefined
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

  // Success state with suggestions
  if (showSuccess) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-primary-100 to-secondary-100 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-xl overflow-hidden">
            <div className="bg-gradient-to-br from-green-500 to-green-700 text-white p-8 text-center">
              <div className="text-5xl mb-4">&#10003;</div>
              <h1 className="text-4xl font-bold mb-2">Practice logged!</h1>
              <p className="text-green-100 text-lg">
                {formData.duration ? `${formData.duration} minutes recorded` : 'Great work!'}
              </p>
            </div>

            <div className="p-8">
              {suggestions.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-lg font-semibold text-gray-700 mb-4">Suggestions</h2>
                  <div className="space-y-4">
                    {suggestions.slice(0, 3).map((suggestion) => (
                      <SuggestionCard
                        key={suggestion.key}
                        suggestion={suggestion}
                        onAccept={() => handleAcceptSuggestion(suggestion)}
                        onDismiss={() => handleDismissSuggestion(suggestion)}
                        onNotYet={() => handleNotYet(suggestion)}
                      />
                    ))}
                  </div>
                  {suggestions.length > 3 && (
                    <p className="text-sm text-gray-500 mt-4 text-center">
                      +{suggestions.length - 3} more suggestions on the{' '}
                      <a
                        href={`/${instrumentName}/suggestions`}
                        className="text-primary-600 hover:underline"
                      >
                        suggestions page
                      </a>
                    </p>
                  )}
                </div>
              )}

              {/* Save as template prompt (freeform submissions with sections only) */}
              {submittedInFreeformMode && submittedFreeformSections.length > 0 && (
                <div className="mb-8">
                  {savedTemplateId ? (
                    <div className="border border-green-300 bg-green-50 rounded-lg p-4 text-center">
                      <p className="text-green-700 font-medium mb-1">Template saved!</p>
                      <a
                        href={`/${instrumentName}/template/edit?templateId=${savedTemplateId}`}
                        className="text-primary-600 hover:underline text-sm"
                      >
                        Edit template
                      </a>
                    </div>
                  ) : showSaveAsTemplate ? (
                    <div className="border border-gray-200 rounded-lg p-4">
                      <p className="text-sm text-gray-500 mb-3">
                        Sections: {submittedFreeformSections.map((s) => s.label).join(', ')}
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={templateName}
                          onChange={(e) => setTemplateName(e.target.value)}
                          placeholder="Template name"
                          className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-primary-500 focus:outline-none text-sm"
                        />
                        <button
                          onClick={handleSaveAsTemplate}
                          disabled={savingTemplate || !templateName.trim()}
                          className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                        >
                          {savingTemplate ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => setShowSaveAsTemplate(false)}
                          className="px-3 py-2 text-gray-500 hover:text-gray-700 text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowSaveAsTemplate(true)}
                      className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors text-sm"
                    >
                      Save this session structure as a template
                    </button>
                  )}
                </div>
              )}

              <div className="flex gap-4">
                <button
                  onClick={handleLogAnother}
                  className="flex-1 bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
                >
                  Log another session
                </button>
                <button
                  onClick={() => router.push(`/${instrumentName}/history`)}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                >
                  View history
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-primary-100 to-secondary-100 pt-14 p-8">
      <div className="fixed top-0 left-0 right-0 z-10 bg-white/90 backdrop-blur-sm border-b border-gray-200 px-8 py-3">
        <div className="max-w-4xl mx-auto">
          <Link
            href={`/${instrumentName}/plan`}
            className="text-sm text-primary-600 hover:text-primary-800 font-medium transition-colors"
          >
            &larr; Back to practice plan
          </Link>
        </div>
      </div>
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
            {!freeformMode && sortedBlocks.filter((b) => !dismissedBlocks.has(b.id)).map((block) => (
              <div key={block.id} className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="block font-semibold text-gray-700">
                    {getBlockLabel(block)}
                    {block.duration_minutes && (
                      <span className="ml-2 text-sm font-normal text-gray-500">
                        ({block.duration_minutes} min)
                      </span>
                    )}
                  </label>
                  <button
                    type="button"
                    onClick={() => setDismissedBlocks(new Set([...dismissedBlocks, block.id]))}
                    className="text-gray-400 hover:text-red-500 text-sm transition-colors"
                    title="Skip this section"
                  >
                    Skip
                  </button>
                </div>

                {block.exercises.length > 0 ? (
                  <div className="space-y-3">
                    <select
                      value={exerciseSelections[block.id]?.exerciseId?.toString() || ''}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                        const exerciseId = parseInt(e.target.value)
                        const exercise = block.exercises.find((ex) => ex.id === exerciseId)
                        handleExerciseSelect(block.id, exercise || null)
                      }}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-500 focus:outline-none"
                    >
                      <option value="">Select exercise...</option>
                      {[...block.exercises]
                        .sort(
                          (a: Exercise, b: Exercise) =>
                            a.display_order - b.display_order
                        )
                        .map((ex: Exercise) => (
                          <option key={ex.id} value={ex.id}>
                            {ex.exercise_text}
                            {ex.tempo_bpm && ` (${ex.tempo_bpm} bpm)`}
                          </option>
                        ))}
                    </select>
                    {exerciseSelections[block.id] && (
                      <div className="pl-4 border-l-2 border-gray-200">
                        <p className="text-sm text-gray-600 mb-2">How did it go?</p>
                        <OutcomeSelector
                          value={exerciseSelections[block.id]?.outcome}
                          onChange={(outcome) => handleOutcomeChange(block.id, outcome)}
                          size="sm"
                        />
                      </div>
                    )}
                  </div>
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
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-700">
                    {freeformMode ? 'Sections' : 'Additional sections'}
                  </h3>
                  <button
                    type="button"
                    onClick={addFreeformSection}
                    className="px-3 py-1 text-sm bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 transition-colors"
                  >
                    + Add section
                  </button>
                </div>

                {freeformMode && freeformSections.length === 0 && (
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
                      <div className="flex-1">
                        <Combobox
                          value={section.label}
                          onChange={(val) =>
                            updateFreeformSection(index, 'label', val)
                          }
                          suggestions={sectionSuggestions}
                          placeholder="Section name (e.g., Warm-up, Scales)"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={section.duration_minutes ?? ''}
                          onChange={(e) =>
                            updateFreeformSection(
                              index,
                              'duration_minutes',
                              e.target.value ? parseInt(e.target.value) : undefined
                            )
                          }
                          placeholder="min"
                          min="1"
                          className="w-16 px-2 py-2 border-2 border-gray-200 rounded-lg focus:border-primary-500 focus:outline-none text-sm text-center"
                        />
                        <span className="text-xs text-gray-400">min</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveFreeformSection(index, 'up')}
                          disabled={index === 0}
                          className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move up"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => moveFreeformSection(index, 'down')}
                          disabled={index === freeformSections.length - 1}
                          className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move down"
                        >
                          ▼
                        </button>
                      </div>
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
                      placeholder={getContentPlaceholder(section.label)}
                      className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-primary-500 focus:outline-none resize-y min-h-[80px] text-sm"
                    />
                    <SectionDetailFields
                      tempo={section.tempo_practiced}
                      keyPracticed={section.key_practiced}
                      timeSignature={section.time_signature}
                      onTempoChange={(val) => updateFreeformSection(index, 'tempo_practiced', val)}
                      onKeyChange={(val) => updateFreeformSection(index, 'key_practiced', val)}
                      onTimeSignatureChange={(val) => updateFreeformSection(index, 'time_signature', val)}
                    />
                    <div className="mt-2">
                      <p className="text-sm text-gray-600 mb-1">How did it go?</p>
                      <OutcomeSelector
                        value={section.outcome}
                        onChange={(outcome) => updateFreeformSection(index, 'outcome', outcome)}
                        size="sm"
                      />
                    </div>
                  </div>
                ))}

                {freeformSections.length > 0 && (
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={addFreeformSection}
                      className="px-3 py-1 text-sm bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 transition-colors"
                    >
                      + Add section
                    </button>
                    {(() => {
                      const sectionTotal = freeformSections.reduce(
                        (sum, s) => sum + (s.duration_minutes ?? 0),
                        0
                      )
                      const overall = parseInt(formData.duration) || 0
                      if (sectionTotal > 0 && overall > 0) {
                        return (
                          <span className="text-xs text-gray-400">
                            {sectionTotal} of {overall} min accounted for
                          </span>
                        )
                      }
                      return null
                    })()}
                  </div>
                )}
              </div>

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
