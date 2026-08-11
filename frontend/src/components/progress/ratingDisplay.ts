import type { BlockLog } from '@/lib/types'

// ---------------------------------------------------------------------------
// Rating presentation for a logged exercise.
//
// The dot colors are the rating-state *icon* tokens (design tokens §2): teal =
// step forward, gray = steady, amber = step back, light gray = skipped. The
// icon token is the state's ink color, which is what a solid dot is — the
// border tokens are tuned to sit against the chevron's own fill and are nearly
// invisible as a fill of their own (steady #D4D0C8 and unselected #E0DED8 are
// barely separable from each other, let alone from card-bg-inset #F0EFEB).
//
// Wording follows the spec's trajectory framing ("Step forward" / "Steady" /
// "Step back"), deliberately not the outcome framing the older wireframe
// sketched — see product spec §5.2, "Rating indicator (chevrons)".
// ---------------------------------------------------------------------------

export interface RatingDisplay {
  label: string
  /** Tailwind background utility for the 8px status dot. */
  dotClass: string
}

const STEP_BACK: RatingDisplay = {
  label: 'Step back',
  dotClass: 'bg-rating-back-icon',
}
const STEADY: RatingDisplay = {
  label: 'Steady',
  dotClass: 'bg-rating-steady-icon',
}
const STEP_FORWARD: RatingDisplay = {
  label: 'Step forward',
  dotClass: 'bg-rating-forward-icon',
}
const SKIPPED: RatingDisplay = {
  label: 'Skipped',
  dotClass: 'bg-rating-unselected-icon',
}
const UNRATED: RatingDisplay = {
  label: 'Not rated',
  dotClass: 'bg-rating-unselected-icon',
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
