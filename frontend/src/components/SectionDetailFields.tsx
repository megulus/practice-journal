'use client'

import { useState, useEffect } from 'react'
import { nextTempo, prevTempo } from '@/lib/metronome'

const KEYS = [
  'C major', 'G major', 'D major', 'A major', 'E major', 'B major',
  'F#/Gb major', 'Db major', 'Ab major', 'Eb major', 'Bb major', 'F major',
  'A minor', 'E minor', 'B minor', 'F# minor', 'C# minor', 'G# minor',
  'Eb/D# minor', 'Bb minor', 'F minor', 'C minor', 'G minor', 'D minor',
]

const TIME_SIGNATURES = [
  '4/4', '3/4', '2/4', '6/8', '2/2', '3/8', '5/4', '7/8', '6/4', '9/8', '12/8',
]

interface SectionDetailFieldsProps {
  tempo?: number
  keyPracticed?: string
  timeSignature?: string
  onTempoChange: (value: number | undefined) => void
  onKeyChange: (value: string | undefined) => void
  onTimeSignatureChange: (value: string | undefined) => void
}

export default function SectionDetailFields({
  tempo,
  keyPracticed,
  timeSignature,
  onTempoChange,
  onKeyChange,
  onTimeSignatureChange,
}: SectionDetailFieldsProps) {
  const hasValues = tempo !== undefined || !!keyPracticed || !!timeSignature
  const [expanded, setExpanded] = useState(hasValues)

  useEffect(() => {
    if (hasValues) setExpanded(true)
  }, [hasValues])

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="text-xs text-primary-600 hover:text-primary-800 mt-1"
      >
        + Add details
      </button>
    )
  }

  return (
    <div className="flex flex-wrap gap-3 mt-2">
      {/* BPM */}
      <div className="flex items-center gap-1">
        <label className="text-xs text-gray-500 mr-1">BPM</label>
        <button
          type="button"
          onClick={() => onTempoChange(prevTempo(tempo ?? 72))}
          className="w-7 h-7 flex items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-100 text-sm"
        >
          -
        </button>
        <input
          type="number"
          value={tempo ?? ''}
          onChange={(e) =>
            onTempoChange(e.target.value ? parseInt(e.target.value) : undefined)
          }
          placeholder="72"
          min="20"
          max="300"
          className="w-16 px-2 py-1 border-2 border-gray-200 rounded-lg focus:border-primary-500 focus:outline-none text-sm text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button
          type="button"
          onClick={() => onTempoChange(nextTempo(tempo ?? 72))}
          className="w-7 h-7 flex items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-100 text-sm"
        >
          +
        </button>
      </div>

      {/* Key */}
      <div className="flex items-center gap-1">
        <label className="text-xs text-gray-500 mr-1">Key</label>
        <select
          value={keyPracticed ?? ''}
          onChange={(e) => onKeyChange(e.target.value || undefined)}
          className="px-2 py-1 border-2 border-gray-200 rounded-lg focus:border-primary-500 focus:outline-none text-sm"
        >
          <option value="">--</option>
          {KEYS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>

      {/* Time signature */}
      <div className="flex items-center gap-1">
        <label className="text-xs text-gray-500 mr-1">Meter</label>
        <select
          value={timeSignature ?? ''}
          onChange={(e) => onTimeSignatureChange(e.target.value || undefined)}
          className="px-2 py-1 border-2 border-gray-200 rounded-lg focus:border-primary-500 focus:outline-none text-sm"
        >
          <option value="">--</option>
          {TIME_SIGNATURES.map((ts) => (
            <option key={ts} value={ts}>
              {ts}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
