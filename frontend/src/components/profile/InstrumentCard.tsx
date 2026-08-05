'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Trash2 } from 'lucide-react'
import { useApi } from '@/lib/useApi'
import { AutoSaveInput, Card, ConfirmDialog, Menu, Pill } from '@/components/ui'
import { count, deleteConfirmCopy } from '@/lib/confirm-copy'
import { formatRelativeDay } from '@/lib/dates'
import type { Instrument, PracticeFrequency } from '@/lib/types'
import { PRACTICE_FREQUENCIES } from './frequencies'

/**
 * A single instrument on the Profile tab: inline-editable name, live
 * practice-frequency pills, a link into the instrument's repertoire library,
 * a summary line, and a delete action (with a cascade warning — deleting an
 * instrument also removes its plans).
 */
export function InstrumentCard({
  instrument,
  onChange,
  onError,
}: {
  instrument: Instrument
  onChange: () => void
  onError?: (message: string) => void
}) {
  const api = useApi()
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const rename = async (name: string) => {
    try {
      await api.updateInstrument(instrument.id, { name })
      onChange()
    } catch {
      onError?.("Couldn't rename the instrument. Please try again.")
      onChange() // resync the field back to the server value
    }
  }

  const setFrequency = async (frequency: PracticeFrequency) => {
    if (frequency === instrument.practice_frequency) return
    try {
      await api.updateInstrument(instrument.id, {
        practice_frequency: frequency,
      })
      onChange()
    } catch {
      onError?.("Couldn't update the practice frequency. Please try again.")
      onChange() // resync the pills to the server value
    }
  }

  const remove = async () => {
    setConfirmingDelete(false)
    try {
      await api.deleteInstrument(instrument.id)
      onChange()
    } catch {
      onError?.("Couldn't delete the instrument. Please try again.")
    }
  }

  const planCount = instrument.active_template_count
  const pieceCount = instrument.piece_count
  const summary = [
    `${planCount} active plan${planCount !== 1 ? 's' : ''}`,
    `${pieceCount} piece${pieceCount !== 1 ? 's' : ''}`,
    instrument.last_practiced_at
      ? `last practiced ${formatRelativeDay(instrument.last_practiced_at)}`
      : 'never practiced',
  ].join(' · ')

  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <AutoSaveInput
          value={instrument.name}
          onCommit={rename}
          aria-label="Instrument name"
          placeholder="Instrument name"
          className="min-w-0 flex-1 bg-transparent text-base font-semibold text-text-primary placeholder:text-text-tertiary focus:outline-none"
        />
        <Menu
          triggerLabel="Instrument actions"
          items={[
            {
              label: 'Delete',
              icon: <Trash2 size={14} />,
              destructive: true,
              onSelect: () => setConfirmingDelete(true),
            },
          ]}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {PRACTICE_FREQUENCIES.map(({ value, label }) => (
          <Pill
            key={value}
            active={instrument.practice_frequency === value}
            aria-pressed={instrument.practice_frequency === value}
            onClick={() => setFrequency(value)}
          >
            {label}
          </Pill>
        ))}
      </div>

      <Link
        href={`/profile/repertoire/${instrument.id}`}
        className="mt-3 inline-flex items-center gap-1 text-sm text-text-link transition-colors hover:text-text-primary"
      >
        Repertoire
        <ChevronRight size={14} strokeWidth={1.5} aria-hidden />
      </Link>

      <p className="mt-3 text-xs text-text-tertiary">{summary}</p>

      {confirmingDelete && (
        <ConfirmDialog
          {...deleteConfirmCopy('instrument', instrument.name, {
            // The backend cascades: templates are soft-deleted and any
            // in-progress log on this instrument is marked abandoned.
            cascade: [
              planCount > 0
                ? `Its ${count(planCount, 'plan')} go too, and any practice session in progress on it ends.`
                : 'Any practice session in progress on it ends.',
            ],
          })}
          confirmLabel="Delete"
          onConfirm={remove}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </Card>
  )
}
