import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
  countsTowardProgress,
  isSectionDone,
  sectionCompletionLabel,
  useLastCompletedSection,
} from './sessionProgress'
import type { BlockLog, SectionLog } from '@/lib/types'

function makeBlock(overrides: Partial<BlockLog> = {}): BlockLog {
  return {
    id: 1,
    block_id: null,
    spot_id: null,
    block_name: 'Block',
    rating: null,
    notes: null,
    completed: false,
    display_order: 0,
    tempo_bpm: null,
    last_tempo_bpm: null,
    ...overrides,
  }
}

function makeSection(overrides: Partial<SectionLog> = {}): SectionLog {
  return {
    id: 1,
    section_id: null,
    section_type: 'scales',
    section_name: 'Scales',
    planned_duration_minutes: 10,
    actual_duration_minutes: 10,
    display_order: 0,
    completed: false,
    skipped: false,
    block_logs: [],
    ...overrides,
  }
}

describe('isSectionDone', () => {
  it('is done when every block is completed', () => {
    expect(
      isSectionDone(
        makeSection({
          block_logs: [
            makeBlock({ id: 1, completed: true }),
            makeBlock({ id: 2, completed: true }),
          ],
        })
      )
    ).toBe(true)
  })

  it('is not done while any block is outstanding', () => {
    expect(
      isSectionDone(
        makeSection({
          block_logs: [
            makeBlock({ id: 1, completed: true }),
            makeBlock({ id: 2, completed: false }),
          ],
        })
      )
    ).toBe(false)
  })

  it('counts a skipped section as done', () => {
    expect(
      isSectionDone(
        makeSection({ skipped: true, block_logs: [makeBlock()] })
      )
    ).toBe(true)
  })

  it('is not done when the section has no blocks yet', () => {
    // `completed` defaults true at session start and nothing maintains it (#233)
    expect(isSectionDone(makeSection({ completed: true }))).toBe(false)
  })
})

describe('countsTowardProgress', () => {
  it('counts a section that has blocks', () => {
    expect(
      countsTowardProgress(makeSection({ block_logs: [makeBlock()] }))
    ).toBe(true)
  })

  it('leaves an empty section out of the ratio', () => {
    // "+ Add a section" creates one of these mid-session; counting it would
    // pin the ratio below 100% for the rest of the session.
    expect(countsTowardProgress(makeSection({ block_logs: [] }))).toBe(false)
    expect(
      countsTowardProgress(makeSection({ block_logs: [], skipped: true }))
    ).toBe(false)
  })
})

describe('sectionCompletionLabel', () => {
  it('reads "<name> complete" for a finished section', () => {
    expect(sectionCompletionLabel(makeSection({ section_name: 'Scales' }))).toBe(
      'Scales complete'
    )
  })

  it('reads "Skipped <name>" for a skipped section', () => {
    expect(
      sectionCompletionLabel(
        makeSection({ section_name: 'warm-up', skipped: true })
      )
    ).toBe('Skipped warm-up')
  })
})

describe('useLastCompletedSection', () => {
  const warmup = makeSection({ id: 1, section_name: 'Warm-up', display_order: 0 })
  const scales = makeSection({ id: 2, section_name: 'Scales', display_order: 1 })

  it('returns null while nothing is done', () => {
    const { result } = renderHook(() =>
      useLastCompletedSection([
        { ...warmup, block_logs: [makeBlock()] },
        { ...scales, block_logs: [makeBlock({ id: 2 })] },
      ])
    )
    expect(result.current).toBeNull()
  })

  it('tracks the section that just flipped to done', () => {
    const { result, rerender } = renderHook(
      ({ sections }: { sections: SectionLog[] }) =>
        useLastCompletedSection(sections),
      {
        initialProps: {
          sections: [
            { ...warmup, block_logs: [makeBlock({ id: 1 })] },
            { ...scales, block_logs: [makeBlock({ id: 2 })] },
          ],
        },
      }
    )
    expect(result.current).toBeNull()

    rerender({
      sections: [
        { ...warmup, block_logs: [makeBlock({ id: 1, completed: true })] },
        { ...scales, block_logs: [makeBlock({ id: 2 })] },
      ],
    })
    expect(result.current?.section_name).toBe('Warm-up')

    rerender({
      sections: [
        { ...warmup, block_logs: [makeBlock({ id: 1, completed: true })] },
        { ...scales, block_logs: [makeBlock({ id: 2, completed: true })] },
      ],
    })
    expect(result.current?.section_name).toBe('Scales')
  })

  it('falls back to the last done section in display order on first load', () => {
    const { result } = renderHook(() =>
      useLastCompletedSection([
        { ...warmup, block_logs: [makeBlock({ id: 1, completed: true })] },
        { ...scales, skipped: true, block_logs: [makeBlock({ id: 2 })] },
      ])
    )
    expect(result.current?.section_name).toBe('Scales')
  })

  it('drops the label when the tracked section stops being done', () => {
    const { result, rerender } = renderHook(
      ({ sections }: { sections: SectionLog[] }) =>
        useLastCompletedSection(sections),
      {
        initialProps: {
          sections: [{ ...scales, skipped: true, block_logs: [makeBlock()] }],
        },
      }
    )
    expect(result.current?.section_name).toBe('Scales')

    rerender({
      sections: [{ ...scales, skipped: false, block_logs: [makeBlock()] }],
    })
    expect(result.current).toBeNull()
  })
})
