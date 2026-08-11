import { describe, it, expect } from 'vitest'
import { ratingDisplay } from './ratingDisplay'
import type { BlockLog } from '@/lib/types'

function block(o: Partial<BlockLog> = {}): BlockLog {
  return {
    id: 1,
    block_id: null,
    spot_id: null,
    block_name: 'Scale',
    rating: null,
    notes: null,
    completed: true,
    display_order: 0,
    tempo_bpm: null,
    last_tempo_bpm: null,
    ...o,
  }
}

describe('ratingDisplay', () => {
  it('maps each rating to its label and token-backed dot', () => {
    expect(ratingDisplay(block({ rating: 1 }))).toEqual({
      label: 'Step forward',
      dotClass: 'bg-rating-forward-icon',
    })
    expect(ratingDisplay(block({ rating: 0 }))).toEqual({
      label: 'Steady',
      dotClass: 'bg-rating-steady-icon',
    })
    expect(ratingDisplay(block({ rating: -1 }))).toEqual({
      label: 'Step back',
      dotClass: 'bg-rating-back-icon',
    })
  })

  it('reads an unfinished exercise as skipped even if it carries a rating', () => {
    expect(ratingDisplay(block({ completed: false, rating: 1 })).label).toBe(
      'Skipped',
    )
  })

  it('distinguishes a finished-but-unrated exercise from a skipped one', () => {
    expect(ratingDisplay(block({ completed: true, rating: null })).label).toBe(
      'Not rated',
    )
  })
})
