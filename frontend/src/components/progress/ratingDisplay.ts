import type { BlockLog } from '@/lib/types'

// ---------------------------------------------------------------------------
// Rating presentation for a logged exercise.
//
// The dot colors are the rating-state border tokens (design tokens §2), the
// same ones the session summary's "How it went" breakdown uses: teal = step
// forward, gray = steady, amber = step back, light gray = skipped.
//
// Wording follows the spec's trajectory framing ("Step forward" / "Steady" /
// "Step back"), deliberately not the outcome framing the older wireframe
// sketched — see product spec §4.3.
// ---------------------------------------------------------------------------

export interface RatingDisplay {
  label: string
  /** Tailwind background utility for the 8px status dot. */
  dotClass: string
}

const STEP_BACK: RatingDisplay = {
  label: 'Step back',
  dotClass: 'bg-rating-back-border',
}
const STEADY: RatingDisplay = {
  label: 'Steady',
  dotClass: 'bg-rating-steady-border',
}
const STEP_FORWARD: RatingDisplay = {
  label: 'Step forward',
  dotClass: 'bg-rating-forward-border',
}
const SKIPPED: RatingDisplay = {
  label: 'Skipped',
  dotClass: 'bg-rating-unselected-border',
}
const UNRATED: RatingDisplay = {
  label: 'Not rated',
  dotClass: 'bg-rating-unselected-border',
}

/**
 * How a block log reads in the History list. An unfinished exercise is
 * "Skipped" regardless of any rating left on it; a finished one without a
 * rating is "Not rated" (the rating step is optional).
 */
export function ratingDisplay(blockLog: BlockLog): RatingDisplay {
  if (!blockLog.completed) return SKIPPED
  switch (blockLog.rating) {
    case -1:
      return STEP_BACK
    case 0:
      return STEADY
    case 1:
      return STEP_FORWARD
    default:
      return UNRATED
  }
}
