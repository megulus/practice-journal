/**
 * Progression Rules Engine
 *
 * Evaluates exercise progress data and generates suggestions for practice improvements.
 * This is the "basic AI" - useful now, and the foundation for richer AI coaching later.
 */

import type { Exercise, ExerciseProgress, Suggestion, SuggestionType } from './types'
import { nextTempo, prevTempo, formatTempo } from './metronome'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProgressionRule {
  id: string
  name: string
  description: string
  condition: (progress: ExerciseProgress, exercise: Exercise) => boolean
  suggestion: (progress: ExerciseProgress, exercise: Exercise) => Omit<Suggestion, 'key' | 'exercise_id' | 'exercise_text'>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Calculate days since a given date.
 */
function daysSince(dateString?: string): number {
  if (!dateString) return Infinity
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

const rules: ProgressionRule[] = [
  // Rule 1: Increase tempo when consistently nailing it
  {
    id: 'tempo_increase',
    name: 'Increase tempo',
    description: 'Suggest faster tempo after consistent success',
    condition: (progress, exercise) =>
      progress.times_practiced >= 4 &&
      progress.nailed_it_count >= 2 &&
      progress.current_tempo != null &&
      progress.current_tempo < 180 &&
      exercise.tempo_bpm != null,
    suggestion: (progress, exercise) => {
      const currentTempo = progress.current_tempo ?? exercise.tempo_bpm!
      const newTempo = nextTempo(currentTempo)
      return {
        type: 'tempo_increase' as SuggestionType,
        message: `You've practiced this ${progress.times_practiced} times at ${formatTempo(currentTempo)}. Ready to try ${formatTempo(newTempo)}?`,
        action: {
          exercise_id: 0, // Will be filled in by evaluator
          field: 'tempo_bpm',
          value: newTempo,
        },
      }
    },
  },

  // Rule 2: Slow down when struggling
  {
    id: 'tempo_decrease',
    name: 'Reduce tempo',
    description: 'Suggest slower tempo when struggling',
    condition: (progress, exercise) =>
      progress.struggled_count >= 3 &&
      progress.struggled_count > progress.nailed_it_count &&
      progress.current_tempo != null &&
      progress.current_tempo > 40 &&
      exercise.tempo_bpm != null,
    suggestion: (progress, exercise) => {
      const currentTempo = progress.current_tempo ?? exercise.tempo_bpm!
      const newTempo = prevTempo(currentTempo)
      return {
        type: 'tempo_decrease' as SuggestionType,
        message: `This seems challenging at ${formatTempo(currentTempo)}. Try slowing down to ${formatTempo(newTempo)}?`,
        action: {
          exercise_id: 0,
          field: 'tempo_bpm',
          value: newTempo,
        },
      }
    },
  },

  // Rule 3: Revisit neglected exercises
  {
    id: 'revisit_stale',
    name: 'Revisit neglected exercise',
    description: 'Suggest returning to exercises not practiced recently',
    condition: (progress) =>
      daysSince(progress.last_practiced_at) > 14 &&
      progress.times_practiced > 0,
    suggestion: (progress) => {
      const days = daysSince(progress.last_practiced_at)
      return {
        type: 'revisit' as SuggestionType,
        message: `You haven't practiced this in ${days} days. Want to add it back to your rotation?`,
      }
    },
  },

  // Rule 4: Celebrate and encourage advancement after mastery
  {
    id: 'advance_mastery',
    name: 'Ready to advance',
    description: 'Suggest moving on after demonstrating mastery',
    condition: (progress) =>
      progress.times_practiced >= 10 &&
      progress.nailed_it_count >= 7 &&
      progress.struggled_count <= 1,
    suggestion: () => ({
      type: 'advance' as SuggestionType,
      message: `You've mastered this exercise! Consider adding a more challenging variation or moving on.`,
    }),
  },

  // Rule 5: Encourage consistency for exercises with mixed results
  {
    id: 'build_consistency',
    name: 'Build consistency',
    description: 'Encourage more practice when results are mixed',
    condition: (progress) =>
      progress.times_practiced >= 5 &&
      progress.okay_count > progress.nailed_it_count &&
      progress.okay_count > progress.struggled_count,
    suggestion: (progress, exercise) => {
      const currentTempo = progress.current_tempo ?? exercise.tempo_bpm
      const tempoNote = currentTempo ? ` at ${formatTempo(currentTempo)}` : ''
      return {
        type: 'new_variation' as SuggestionType,
        message: `You're doing okay${tempoNote}, but not quite consistent yet. Keep practicing to build muscle memory!`,
      }
    },
  },
]

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate all rules against exercise progress data and generate suggestions.
 *
 * @param exercises - List of exercises with metadata
 * @param progressRecords - Progress records keyed by exercise_id
 * @param dismissedKeys - Set of suggestion keys that have been dismissed
 * @returns Array of suggestions that match current conditions
 */
export function evaluateRules(
  exercises: Exercise[],
  progressRecords: ExerciseProgress[],
  dismissedKeys: Set<string> = new Set()
): Suggestion[] {
  const suggestions: Suggestion[] = []

  // Create a map of exercise_id -> progress for quick lookup
  const progressMap = new Map<number, ExerciseProgress>()
  for (const p of progressRecords) {
    progressMap.set(p.exercise_id, p)
  }

  for (const exercise of exercises) {
    const progress = progressMap.get(exercise.id)
    if (!progress) continue // No progress data yet

    for (const rule of rules) {
      const suggestionKey = `exercise_${exercise.id}_${rule.id}`

      // Skip if already dismissed
      if (dismissedKeys.has(suggestionKey)) continue

      // Check if rule condition is met
      if (rule.condition(progress, exercise)) {
        const baseSuggestion = rule.suggestion(progress, exercise)

        // Fill in exercise details
        const suggestion: Suggestion = {
          key: suggestionKey,
          exercise_id: exercise.id,
          exercise_text: exercise.exercise_text,
          ...baseSuggestion,
        }

        // Fill in action exercise_id if present
        if (suggestion.action) {
          suggestion.action.exercise_id = exercise.id
        }

        suggestions.push(suggestion)
        break // Only one suggestion per exercise
      }
    }
  }

  return suggestions
}

/**
 * Get the list of available rules (for debugging/admin purposes).
 */
export function getRules(): Pick<ProgressionRule, 'id' | 'name' | 'description'>[] {
  return rules.map(({ id, name, description }) => ({ id, name, description }))
}
