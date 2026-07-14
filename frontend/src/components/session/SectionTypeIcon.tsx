'use client'

// ---------------------------------------------------------------------------
// Section type icon (colored dot)
// ---------------------------------------------------------------------------

export function SectionTypeIcon({ type }: { type: string }) {
  const colors: Record<string, string> = {
    warmup: 'bg-orange-400',
    scales: 'bg-blue-400',
    repertoire: 'bg-purple-400',
    sight_reading: 'bg-green-400',
    ear_training: 'bg-cyan-400',
    cooldown: 'bg-indigo-400',
    other: 'bg-gray-400',
  }
  return (
    <span
      className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${colors[type] ?? 'bg-gray-400'}`}
    />
  )
}
