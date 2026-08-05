'use client'

import { Button, Pill, TextInput } from '@/components/ui'
import { QUICK_START_INSTRUMENTS } from '@/lib/quickstart'
import type { Instrument } from '@/lib/types'
import { WizardFrame } from './WizardFrame'
import {
  selectionKey,
  type InstrumentSelection,
} from './instrumentSelection'

export interface StepInstrumentProps {
  /** Instruments the user already has — offered before the presets. */
  instruments: Instrument[]
  selection: InstrumentSelection | null
  onSelect: (selection: InstrumentSelection) => void
  otherName: string
  onOtherNameChange: (name: string) => void
  canContinue: boolean
  onNext: () => void
  onSkip: () => void
  totalSteps: number
}

/**
 * Step 1 — "What do you play?" (spec §5.6). Single selection from a grid of
 * common instruments, plus "Other…" for anything else.
 */
export function StepInstrument({
  instruments,
  selection,
  onSelect,
  otherName,
  onOtherNameChange,
  canContinue,
  onNext,
  onSkip,
  totalSteps,
}: StepInstrumentProps) {
  const existingNames = new Set(
    instruments.map((i) => i.name.trim().toLowerCase()),
  )
  const presets = QUICK_START_INSTRUMENTS.filter(
    (name) => !existingNames.has(name.toLowerCase()),
  )
  const active = selection ? selectionKey(selection) : null

  const options: { key: string; label: string; selection: InstrumentSelection }[] =
    [
      ...instruments.map((i) => ({
        key: `existing:${i.id}`,
        label: i.name,
        selection: { kind: 'existing', id: i.id } as InstrumentSelection,
      })),
      ...presets.map((name) => ({
        key: `preset:${name}`,
        label: name,
        selection: { kind: 'preset', name } as InstrumentSelection,
      })),
      { key: 'other', label: 'Other…', selection: { kind: 'other' } },
    ]

  return (
    <WizardFrame
      step={1}
      totalSteps={totalSteps}
      title="What do you play?"
      subtitle="Pick your primary instrument. You can add more later."
      action={{ label: 'Skip setup', onClick: onSkip }}
    >
      <div role="group" aria-label="Instrument" className="flex flex-wrap gap-md">
        {options.map((option) => (
          <Pill
            key={option.key}
            variant="instrument"
            active={active === option.key}
            onClick={() => onSelect(option.selection)}
          >
            {option.label}
          </Pill>
        ))}
      </div>

      {selection?.kind === 'other' && (
        <div className="mt-2xl">
          <label
            htmlFor="quickstart-other-instrument"
            className="mb-md block text-[13px] font-medium leading-[1.5] text-text-primary"
          >
            Instrument name
          </label>
          <TextInput
            id="quickstart-other-instrument"
            autoFocus
            value={otherName}
            onChange={(e) => onOtherNameChange(e.target.value)}
            placeholder="e.g. Mandolin, drums, harp…"
          />
        </div>
      )}

      <Button
        fullWidth
        className="mt-2xl"
        disabled={!canContinue}
        onClick={onNext}
      >
        Next
      </Button>
    </WizardFrame>
  )
}
