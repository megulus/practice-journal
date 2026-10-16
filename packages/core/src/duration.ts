/**
 * Human-friendly practice durations. Minutes are the unit everywhere in the
 * API, but an hour-plus week reads badly as "102 min", so anything over an
 * hour gets split: "1 hr 42 min" / "2 hr" / "45 min" / "0 min".
 */
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes))
  const hours = Math.floor(total / 60)
  const mins = total % 60
  if (hours === 0) return `${mins} min`
  if (mins === 0) return `${hours} hr`
  return `${hours} hr ${mins} min`
}
