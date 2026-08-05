import { describe, it, expect } from 'vitest'
import {
  DEFAULT_AREA_TYPES,
  GENERIC_PLAN_NAME,
  QUICK_START_AREAS,
  allocateMinutes,
  buildQuickStartPlan,
  needsQuickStart,
} from './quickstart'
import type { Instrument, SectionType, TodayResponse } from './types'

function makeInstrument(o: Partial<Instrument> = {}): Instrument {
  return {
    id: 1,
    name: 'Violin',
    instrument_category: 'violin',
    practice_frequency: 'daily',
    display_order: 0,
    active_template_count: 0,
    piece_count: 0,
    last_practiced_at: null,
    ...o,
  }
}

function makeToday(o: Partial<TodayResponse> = {}): TodayResponse {
  return {
    active_session: null,
    instruments_due: [],
    instruments_not_due: [],
    ...o,
  }
}

const ALL_AREAS = QUICK_START_AREAS.map((a) => a.type)

describe('allocateMinutes', () => {
  it('splits the budget proportionally', () => {
    expect(allocateMinutes([1, 1], 30)).toEqual([15, 15])
    expect(allocateMinutes([1, 3], 40)).toEqual([10, 30])
  })

  it('always adds back up to the requested total', () => {
    for (const total of [15, 30, 45, 60]) {
      for (let n = 1; n <= QUICK_START_AREAS.length; n++) {
        const weights = QUICK_START_AREAS.slice(0, n).map((a) => a.weight)
        const parts = allocateMinutes(weights, total)
        expect(parts.reduce((a, b) => a + b, 0)).toBe(total)
      }
    }
  })

  it('never rounds a selected area down to zero', () => {
    // Six areas out of a 15-minute budget is the tightest case the UI allows.
    const weights = QUICK_START_AREAS.map((a) => a.weight)
    expect(allocateMinutes(weights, 15).every((m) => m >= 1)).toBe(true)
  })

  it('handles degenerate inputs without dividing by zero', () => {
    expect(allocateMinutes([], 30)).toEqual([])
    expect(allocateMinutes([0, 0], 30)).toEqual([0, 0])
    expect(allocateMinutes([1, 2], 0)).toEqual([0, 0])
  })
})

describe('buildQuickStartPlan', () => {
  const defaults = { areaTypes: DEFAULT_AREA_TYPES, minutes: 30 }

  it('reproduces the wireframe plan for the defaults at 30 minutes', () => {
    const plan = buildQuickStartPlan({ ...defaults, planName: 'Bruch' })

    expect(plan.name).toBe('Bruch')
    expect(plan.totalMinutes).toBe(30)
    expect(
      plan.sections.map((s) => [
        s.section_type,
        s.estimated_duration_minutes,
      ]),
    ).toEqual([
      ['warmup', 5],
      ['scales', 7],
      ['repertoire', 15],
      ['cooldown', 3],
    ])
  })

  it('keeps sections in catalog order however the areas were toggled', () => {
    const plan = buildQuickStartPlan({
      ...defaults,
      areaTypes: ['cooldown', 'repertoire', 'warmup'] as SectionType[],
    })
    expect(plan.sections.map((s) => s.section_type)).toEqual([
      'warmup',
      'repertoire',
      'cooldown',
    ])
  })

  it('rebalances to a different time budget', () => {
    const plan = buildQuickStartPlan({ ...defaults, minutes: 60 })
    expect(plan.totalMinutes).toBe(60)
    expect(plan.sections.map((s) => s.estimated_duration_minutes)).toEqual([
      10, 14, 30, 6,
    ])
  })

  it('gives every selected area a section with one seed block', () => {
    const plan = buildQuickStartPlan({ ...defaults, areaTypes: ALL_AREAS })
    expect(plan.sections).toHaveLength(QUICK_START_AREAS.length)
    for (const section of plan.sections) {
      expect(section.block.name).toBeTruthy()
      expect(section.block.description).toBeTruthy()
    }
  })

  it('falls back to a generic plan name when the goal was skipped', () => {
    expect(buildQuickStartPlan(defaults).name).toBe(GENERIC_PLAN_NAME)
    expect(buildQuickStartPlan({ ...defaults, planName: '   ' }).name).toBe(
      GENERIC_PLAN_NAME,
    )
  })

  it('trims the goal into the plan name', () => {
    expect(
      buildQuickStartPlan({ ...defaults, planName: '  Autumn Leaves  ' }).name,
    ).toBe('Autumn Leaves')
  })

  it('makes the named piece the repertoire block', () => {
    const plan = buildQuickStartPlan({
      ...defaults,
      pieceName: '  Bruch Violin Concerto  ',
    })
    const repertoire = plan.sections.find(
      (s) => s.section_type === 'repertoire',
    )
    expect(repertoire?.block.name).toBe('Bruch Violin Concerto')
  })

  it('leaves the repertoire block generic when no piece was named', () => {
    const plan = buildQuickStartPlan({ ...defaults, pieceName: '  ' })
    const repertoire = plan.sections.find(
      (s) => s.section_type === 'repertoire',
    )
    expect(repertoire?.block.name).toBe('Repertoire')
  })

  it('produces an empty plan when nothing is selected', () => {
    const plan = buildQuickStartPlan({ ...defaults, areaTypes: [] })
    expect(plan.sections).toEqual([])
    expect(plan.totalMinutes).toBe(0)
  })
})

describe('needsQuickStart', () => {
  it('is true for a user with no instruments', () => {
    expect(needsQuickStart([], makeToday())).toBe(true)
  })

  it('is true when every instrument is planless', () => {
    expect(
      needsQuickStart(
        [makeInstrument({ id: 1 }), makeInstrument({ id: 2 })],
        makeToday(),
      ),
    ).toBe(true)
  })

  it('is false as soon as one instrument has an active plan', () => {
    expect(
      needsQuickStart(
        [
          makeInstrument({ id: 1 }),
          makeInstrument({ id: 2, active_template_count: 1 }),
        ],
        makeToday(),
      ),
    ).toBe(false)
  })

  it('is false while a session is in progress, so it can be resumed', () => {
    expect(
      needsQuickStart(
        [],
        makeToday({
          active_session: {
            practice_log_id: 7,
            instrument_id: 1,
            instrument_name: 'Violin',
            session_name: null,
            started_at: '2026-08-05T10:00:00',
          },
        }),
      ),
    ).toBe(false)
  })
})
