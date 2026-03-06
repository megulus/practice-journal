import { describe, it, expect } from 'vitest'
import { evaluateRules, getRules } from './progressionRules'
import type { Exercise, ExerciseProgress } from './types'

function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 1,
    exercise_text: 'G Major Scale',
    display_order: 0,
    tempo_bpm: 80,
    ...overrides,
  }
}

function makeProgress(overrides: Partial<ExerciseProgress> = {}): ExerciseProgress {
  return {
    id: 1,
    exercise_id: 1,
    times_practiced: 0,
    struggled_count: 0,
    okay_count: 0,
    nailed_it_count: 0,
    ...overrides,
  }
}

describe('evaluateRules', () => {
  it('returns empty when no progress data exists', () => {
    const exercises = [makeExercise()]
    const result = evaluateRules(exercises, [])
    expect(result).toEqual([])
  })

  it('suggests tempo increase after consistent success', () => {
    const exercise = makeExercise({ id: 1, tempo_bpm: 80 })
    const progress = makeProgress({
      exercise_id: 1,
      times_practiced: 5,
      nailed_it_count: 3,
      current_tempo: 80,
    })

    const suggestions = evaluateRules([exercise], [progress])
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].type).toBe('tempo_increase')
    expect(suggestions[0].action?.field).toBe('tempo_bpm')
    expect(suggestions[0].action!.value).toBeGreaterThan(80)
  })

  it('suggests tempo decrease when struggling', () => {
    const exercise = makeExercise({ id: 1, tempo_bpm: 100 })
    const progress = makeProgress({
      exercise_id: 1,
      times_practiced: 5,
      struggled_count: 4,
      nailed_it_count: 0,
      current_tempo: 100,
    })

    const suggestions = evaluateRules([exercise], [progress])
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].type).toBe('tempo_decrease')
    expect(suggestions[0].action!.value).toBeLessThan(100)
  })

  it('suggests revisiting neglected exercises', () => {
    const exercise = makeExercise({ id: 1 })
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
    const progress = makeProgress({
      exercise_id: 1,
      times_practiced: 3,
      last_practiced_at: thirtyDaysAgo,
    })

    const suggestions = evaluateRules([exercise], [progress])
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].type).toBe('revisit')
    expect(suggestions[0].message).toContain('days')
  })

  it('suggests advancement after mastery', () => {
    const exercise = makeExercise({ id: 1 })
    const progress = makeProgress({
      exercise_id: 1,
      times_practiced: 12,
      nailed_it_count: 10,
      struggled_count: 0,
      last_practiced_at: new Date().toISOString(),
    })

    const suggestions = evaluateRules([exercise], [progress])
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].type).toBe('advance')
  })

  it('returns only one suggestion per exercise', () => {
    const exercise = makeExercise({ id: 1, tempo_bpm: 80 })
    // This progress could match multiple rules
    const progress = makeProgress({
      exercise_id: 1,
      times_practiced: 12,
      nailed_it_count: 8,
      struggled_count: 0,
      current_tempo: 80,
      last_practiced_at: new Date().toISOString(),
    })

    const suggestions = evaluateRules([exercise], [progress])
    expect(suggestions).toHaveLength(1)
  })

  it('respects dismissed suggestions', () => {
    const exercise = makeExercise({ id: 1, tempo_bpm: 80 })
    const progress = makeProgress({
      exercise_id: 1,
      times_practiced: 5,
      nailed_it_count: 3,
      current_tempo: 80,
    })

    const dismissed = new Set(['exercise_1_tempo_increase'])
    const suggestions = evaluateRules([exercise], [progress], dismissed)
    // The tempo_increase was dismissed, so it should try the next matching rule
    // or return nothing if no other rules match
    expect(suggestions.every((s) => s.key !== 'exercise_1_tempo_increase')).toBe(true)
  })

  it('handles multiple exercises independently', () => {
    const exercises = [
      makeExercise({ id: 1, tempo_bpm: 80 }),
      makeExercise({ id: 2, exercise_text: 'Arpeggios', tempo_bpm: 60 }),
    ]
    const progress = [
      makeProgress({
        exercise_id: 1,
        times_practiced: 5,
        nailed_it_count: 3,
        current_tempo: 80,
      }),
      makeProgress({
        id: 2,
        exercise_id: 2,
        times_practiced: 5,
        struggled_count: 4,
        nailed_it_count: 0,
        current_tempo: 60,
      }),
    ]

    const suggestions = evaluateRules(exercises, progress)
    expect(suggestions).toHaveLength(2)

    const types = suggestions.map((s) => s.type)
    expect(types).toContain('tempo_increase')
    expect(types).toContain('tempo_decrease')
  })

  it('fills in exercise details on suggestions', () => {
    const exercise = makeExercise({ id: 42, exercise_text: 'Shifting Drill' })
    const progress = makeProgress({
      exercise_id: 42,
      times_practiced: 12,
      nailed_it_count: 10,
      struggled_count: 0,
      last_practiced_at: new Date().toISOString(),
    })

    const suggestions = evaluateRules([exercise], [progress])
    expect(suggestions[0].exercise_id).toBe(42)
    expect(suggestions[0].exercise_text).toBe('Shifting Drill')
    expect(suggestions[0].key).toContain('exercise_42_')
  })
})

describe('getRules', () => {
  it('returns rule metadata without implementation details', () => {
    const rules = getRules()
    expect(rules.length).toBeGreaterThan(0)
    for (const rule of rules) {
      expect(rule).toHaveProperty('id')
      expect(rule).toHaveProperty('name')
      expect(rule).toHaveProperty('description')
      expect(rule).not.toHaveProperty('condition')
      expect(rule).not.toHaveProperty('suggestion')
    }
  })
})
