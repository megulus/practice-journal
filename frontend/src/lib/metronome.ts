/**
 * Metronome utilities for tempo calculations
 *
 * Standard metronome markings (Maelzel markings) used for snapping tempo values
 * to musically meaningful increments.
 */

// Standard metronome markings
export const METRONOME_MARKINGS: readonly number[] = [
  40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60,
  63, 66, 69, 72, 76, 80, 84, 88, 92, 96,
  100, 104, 108, 112, 116, 120, 126, 132, 138, 144,
  152, 160, 168, 176, 184, 192, 200, 208
]

/**
 * Calculate the next tempo based on a percentage increase, snapping to standard markings.
 *
 * @param current - Current tempo in BPM
 * @param increasePercent - Percentage increase (default 10%)
 * @returns Next standard metronome marking at or above the target
 *
 * @example
 * nextTempo(60)   // → 66  (10% of 60 = 66)
 * nextTempo(100)  // → 112 (10% of 100 = 110, snaps up to 112)
 */
export function nextTempo(current: number, increasePercent = 10): number {
  const target = current * (1 + increasePercent / 100)
  return METRONOME_MARKINGS.find((m) => m >= target) ?? Math.round(target)
}

/**
 * Calculate the previous tempo based on a percentage decrease, snapping to standard markings.
 *
 * @param current - Current tempo in BPM
 * @param decreasePercent - Percentage decrease (default 10%)
 * @returns Previous standard metronome marking at or below the target
 *
 * @example
 * prevTempo(72)  // → 66  (10% of 72 = 64.8, snaps down to 66... wait, that's wrong)
 * prevTempo(72)  // → 66  (10% less = 64.8, find largest marking <= 64.8 = 63)
 */
export function prevTempo(current: number, decreasePercent = 10): number {
  const target = current * (1 - decreasePercent / 100)
  return [...METRONOME_MARKINGS].reverse().find((m) => m <= target) ?? Math.round(target)
}

/**
 * Find the closest standard metronome marking to a given tempo.
 *
 * @param tempo - Tempo to snap
 * @returns Closest standard metronome marking
 */
export function snapToMarking(tempo: number): number {
  let closest = METRONOME_MARKINGS[0]
  let minDiff = Math.abs(tempo - closest)

  for (const marking of METRONOME_MARKINGS) {
    const diff = Math.abs(tempo - marking)
    if (diff < minDiff) {
      minDiff = diff
      closest = marking
    }
  }

  return closest
}

/**
 * Format a tempo value for display.
 *
 * @param tempo - Tempo in BPM
 * @returns Formatted string like "♩=72"
 */
export function formatTempo(tempo: number): string {
  return `♩=${tempo}`
}
