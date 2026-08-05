/**
 * Quick-start wizard logic (product spec §5.6).
 *
 * The wizard has to show a live plan preview before anything is persisted, so
 * the balancing rules live here rather than on the backend: `buildQuickStartPlan`
 * produces both the preview the user reads on step 5 and the exact payload
 * `POST /api/quickstart` receives.
 */
import type {
  Instrument,
  QuickStartSection,
  SectionType,
  TodayResponse,
} from './types'

/** Step 1's instrument grid, in wireframe order. "Other…" is handled by the UI. */
export const QUICK_START_INSTRUMENTS = [
  'Violin',
  'Viola',
  'Cello',
  'Piano',
  'Guitar',
  'Flute',
  'Voice',
] as const

export interface QuickStartArea {
  type: SectionType
  /** Checkbox label on step 3, and the generated section's name. */
  label: string
  /** One-line hint shown in the preview and stored on the seed block. */
  description: string
  /**
   * Share of the time budget. Ratios are the wireframe's 30-minute plan
   * (warm-up 5 / scales 7 / repertoire 15 / cool-down 3), so the default
   * selection at 30 minutes reproduces it exactly.
   */
  weight: number
  defaultSelected: boolean
}

export const QUICK_START_AREAS: QuickStartArea[] = [
  {
    type: 'warmup',
    label: 'Warm-up',
    description: 'Easy playing to loosen up',
    weight: 5,
    defaultSelected: true,
  },
  {
    type: 'scales',
    label: 'Scales and technique',
    description: 'Scales and arpeggios, slow and even',
    weight: 7,
    defaultSelected: true,
  },
  {
    type: 'repertoire',
    label: 'Repertoire',
    description: 'Slow practice on what you are learning',
    weight: 15,
    defaultSelected: true,
  },
  {
    type: 'sight_reading',
    label: 'Sight-reading',
    description: 'Read something new at a comfortable tempo',
    weight: 5,
    defaultSelected: false,
  },
  {
    type: 'ear_training',
    label: 'Ear training',
    description: 'Intervals, chords, and playing by ear',
    weight: 5,
    defaultSelected: false,
  },
  {
    type: 'cooldown',
    label: 'Cool-down',
    description: 'Easy playing, then reflect on the session',
    weight: 3,
    defaultSelected: true,
  },
]

export const DEFAULT_AREA_TYPES: SectionType[] = QUICK_START_AREAS.filter(
  (a) => a.defaultSelected,
).map((a) => a.type)

/** Step 5's time-budget buttons. */
export const TIME_BUDGETS = [15, 30, 45, 60] as const
export const DEFAULT_TIME_BUDGET = 30

/** Plan name when the user skips the goal step ("just get me started"). */
export const GENERIC_PLAN_NAME = 'Daily practice'

export interface QuickStartPlan {
  name: string
  totalMinutes: number
  sections: QuickStartSection[]
}

export interface BuildQuickStartPlanInput {
  /** Selected area types; rendered in `QUICK_START_AREAS` order regardless. */
  areaTypes: SectionType[]
  minutes: number
  /** The step-2 goal. Blank falls back to {@link GENERIC_PLAN_NAME}. */
  planName?: string
  /** The step-4 piece. Blank leaves the repertoire section generic. */
  pieceName?: string
}

/**
 * Split `total` minutes across `weights`, proportionally.
 *
 * Largest-remainder rounding, so the parts always add back up to exactly the
 * budget the user picked — and no selected area is rounded down to nothing.
 */
export function allocateMinutes(weights: number[], total: number): number[] {
  const n = weights.length
  if (n === 0) return []
  const weightSum = weights.reduce((a, b) => a + b, 0)
  if (weightSum <= 0 || total <= 0) return weights.map(() => 0)

  const raw = weights.map((w) => (w * total) / weightSum)
  const out = raw.map((r) => Math.floor(r))

  let leftover = total - out.reduce((a, b) => a + b, 0)
  const byFraction = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i)
  for (let k = 0; leftover > 0; k++, leftover--) {
    out[byFraction[k % n].i] += 1
  }

  // A section the user explicitly asked for shouldn't show up as 0 min. Only
  // possible to fix when there's at least a minute to go around.
  if (total >= n) {
    for (let i = 0; i < n; i++) {
      while (out[i] < 1) {
        const donor = out.indexOf(Math.max(...out))
        if (out[donor] <= 1) break
        out[donor] -= 1
        out[i] += 1
      }
    }
  }

  return out
}

/**
 * Turn the wizard's answers into a balanced single-session plan.
 *
 * Each selected area becomes one section holding one seed block. When a piece
 * was named it becomes the repertoire section's block — the backend turns that
 * into a real repertoire block against the piece it creates.
 */
export function buildQuickStartPlan({
  areaTypes,
  minutes,
  planName,
  pieceName,
}: BuildQuickStartPlanInput): QuickStartPlan {
  const selected = QUICK_START_AREAS.filter((a) => areaTypes.includes(a.type))
  const durations = allocateMinutes(
    selected.map((a) => a.weight),
    minutes,
  )
  const piece = pieceName?.trim()

  const sections: QuickStartSection[] = selected.map((area, i) => ({
    name: area.label,
    section_type: area.type,
    estimated_duration_minutes: durations[i],
    block: {
      name: area.type === 'repertoire' && piece ? piece : area.label,
      description: area.description,
    },
  }))

  return {
    name: planName?.trim() || GENERIC_PLAN_NAME,
    totalMinutes: sections.reduce(
      (sum, s) => sum + s.estimated_duration_minutes,
      0,
    ),
    sections,
  }
}

/**
 * Whether the Today tab should hand the user to the wizard instead of the
 * usual plan card: no active plan anywhere, and nothing mid-session to resume.
 * A user with no instruments at all qualifies (`every` on an empty list).
 */
export function needsQuickStart(
  instruments: Instrument[],
  today: TodayResponse,
): boolean {
  if (today.active_session) return false
  return instruments.every((i) => i.active_template_count === 0)
}
