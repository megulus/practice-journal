'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useApi } from '@/lib/useApi'
import { AutoSaveInput, Card, Menu, Pill } from '@/components/ui'
import ConfirmDialog from '@/components/ConfirmDialog'
import { formatRelativeDay } from '@/lib/dates'
import type { Instrument, PracticeFrequency } from '@/lib/types'
import { PRACTICE_FREQUENCIES } from './frequencies'

/**
 * A single instrument on the Profile tab: inline-editable name, live
 * practice-frequency pills, a summary line, and a delete action (with a
 * cascade warning — deleting an instrument also removes its plans).
 */
export function InstrumentCard({
  instrument,
  onChange,
}: {
  instrument: Instrument
  onChange: () => void
}) {
  const api = useApi()
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const rename = async (name: string) => {
    await api.updateInstrument(instrument.id, { name })
    onChange()
  }

  const setFrequency = async (frequency: PracticeFrequency) => {
    if (frequency === instrument.practice_frequency) return
    await api.updateInstrument(instrument.id, { practice_frequency: frequency })
    onChange()
  }

  const remove = async () => {
    setConfirmingDelete(false)
    await api.deleteInstrument(instrument.id)
    onChange()
  }

  const planCount = instrument.active_template_count
  const summary =
    `${planCount} active plan${planCount !== 1 ? 's' : ''} · ` +
    (instrument.last_practiced_at
      ? `last practiced ${formatRelativeDay(instrument.last_practiced_at)}`
      : 'never practiced')

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

      <p className="mt-3 text-xs text-text-tertiary">{summary}</p>

      {confirmingDelete && (
        <ConfirmDialog
          title={`Delete ${instrument.name}?`}
          message={
            planCount > 0
              ? `This removes ${instrument.name} and its ${planCount} plan${planCount !== 1 ? 's' : ''}. This can't be undone.`
              : `This removes ${instrument.name}. This can't be undone.`
          }
          confirmLabel="Delete"
          confirmVariant="danger"
          onConfirm={remove}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </Card>
  )
}
