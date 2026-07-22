import type { PracticeFrequency } from '@/lib/types'

/** Practice cadence options, in order, with their display labels (spec §5.8). */
export const PRACTICE_FREQUENCIES: {
  value: PracticeFrequency
  label: string
}[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'few_times_a_week', label: 'Few times a week' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'occasionally', label: 'Occasionally' },
]
