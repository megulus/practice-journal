'use client'

import { useState } from 'react'
import type { ExerciseBlock, BlockType } from '@/lib/types'
import type { createAuthenticatedAPI } from '@/lib/api'
import ExerciseRow from './ExerciseRow'

interface BlockEditorProps {
  block: ExerciseBlock
  blockTypes: BlockType[]
  templateId: number
  dayNumber: number
  isFirst: boolean
  isLast: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
  onRefresh: () => void
  api: ReturnType<typeof createAuthenticatedAPI>
}

export default function BlockEditor({
  block,
  blockTypes,
  templateId,
  dayNumber,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onDelete,
  onRefresh,
  api,
}: BlockEditorProps) {
  const [duration, setDuration] = useState(String(block.duration_minutes ?? ''))
  const [newExercise, setNewExercise] = useState('')
  const [saving, setSaving] = useState(false)

  const blockType = blockTypes.find((bt) => bt.id === block.block_type_id)
  const label = blockType?.label ?? block.block_type

  async function handleDurationBlur() {
    const parsed = parseInt(duration, 10)
    if (isNaN(parsed) || parsed === block.duration_minutes) return
    setSaving(true)
    try {
      await api.updateBlock(templateId, dayNumber, block.id, { duration_minutes: parsed })
      onRefresh()
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  async function handleAddExercise() {
    const text = newExercise.trim()
    if (!text) return
    setSaving(true)
    try {
      await api.createExercise(templateId, dayNumber, block.id, { exercise_text: text })
      setNewExercise('')
      onRefresh()
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdateExercise(exerciseId: number, newText: string) {
    try {
      await api.updateExercise(templateId, dayNumber, block.id, exerciseId, {
        exercise_text: newText,
      })
      onRefresh()
    } catch (e) {
      console.error(e)
    }
  }

  async function handleDeleteExercise(exerciseId: number) {
    try {
      await api.deleteExercise(templateId, dayNumber, block.id, exerciseId)
      onRefresh()
    } catch (e) {
      console.error(e)
    }
  }

  function handleExerciseKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddExercise()
    }
  }

  const sortedExercises = [...block.exercises].sort(
    (a, b) => a.display_order - b.display_order
  )

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1">
          <span className="font-semibold text-gray-800">{label}</span>
        </div>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            onBlur={handleDurationBlur}
            className="w-16 text-sm border border-gray-300 rounded px-2 py-1 text-center"
            min={1}
          />
          <span className="text-sm text-gray-500">min</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onMoveUp}
            disabled={isFirst}
            className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Move up"
          >
            ▲
          </button>
          <button
            onClick={onMoveDown}
            disabled={isLast}
            className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Move down"
          >
            ▼
          </button>
          <button
            onClick={onDelete}
            className="p-1 text-red-400 hover:text-red-600 ml-1"
            title="Delete block"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Exercises */}
      <div className="ml-1">
        {sortedExercises.map((ex) => (
          <ExerciseRow
            key={ex.id}
            exerciseId={ex.id}
            text={ex.exercise_text}
            onUpdate={handleUpdateExercise}
            onDelete={handleDeleteExercise}
          />
        ))}
        <div className="flex items-center gap-2 mt-2">
          <input
            type="text"
            value={newExercise}
            onChange={(e) => setNewExercise(e.target.value)}
            onKeyDown={handleExerciseKeyDown}
            placeholder="Add exercise..."
            className="flex-1 text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-primary-400"
            disabled={saving}
          />
          <button
            onClick={handleAddExercise}
            disabled={saving || !newExercise.trim()}
            className="text-sm text-primary-600 hover:text-primary-800 font-medium disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}
