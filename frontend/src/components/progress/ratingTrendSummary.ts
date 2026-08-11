import type { RatingsWeek } from '@/lib/types'

/**
 * Plain-language read on the rating distribution (spec §5.7, Insights #3).
 *
 * Compares the share of "step forward" ratings in the most recent week that
 * has any against the average share of the earlier weeks. Deliberately not a
 * verdict on the player: a week with more step-backs gets framed as working at
 * the edge, which is what the rating scale means (spec §5.2) — the chevrons
 * track trajectory, not quality.
 *
 * `weeks` is the API's order: most recent first.
 */
export function ratingTrendSummary(weeks: RatingsWeek[]): string {
  const rated = weeks.filter((w) => w.total > 0)

  if (rated.length === 0) {
    return 'No ratings yet — rate a few exercises and the trend shows up here.'
  }

  const share = (w: RatingsWeek) => w.step_forward / w.total

  if (rated.length === 1) {
    const w = rated[0]
    return `${w.step_forward} of ${w.total} rated exercise${
      w.total === 1 ? '' : 's'
    } stepped forward. One more week of ratings will show a trend.`
  }

  const recent = share(rated[0])
  const prior =
    rated.slice(1).reduce((sum, w) => sum + share(w), 0) / (rated.length - 1)
  const diff = recent - prior

  if (diff > 0.1) {
    return 'Trending up — more exercises moving forward than in previous weeks.'
  }
  if (diff < -0.1) {
    return 'More step-backs lately — often a sign you are working at the edge of what you can do.'
  }
  return 'Holding steady — about the same mix as previous weeks.'
}

/** "This week" / "Last week" / "2 weeks ago" for the row labels. */
export function weekAgoLabel(index: number): string {
  if (index === 0) return 'This week'
  if (index === 1) return 'Last week'
  return `${index} weeks ago`
}
