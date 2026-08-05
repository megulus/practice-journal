'use client'

import { Button, TextInput, VoiceInput } from '@/components/ui'
import { WizardFrame, WIZARD_HINT, WIZARD_LINK } from './WizardFrame'

export interface StepPieceProps {
  value: string
  onChange: (value: string) => void
  onNext: () => void
  onBack: () => void
  /** "Skip — I'll add later": clears the field and moves on. */
  onSkip: () => void
  totalSteps: number
}

/**
 * Step 4 — "Anything you're working on right now?" (spec §5.6). Optional, and
 * deliberately just a name: whatever is typed becomes a Piece in the
 * instrument's library and the subject of the plan's repertoire block.
 */
export function StepPiece({
  value,
  onChange,
  onNext,
  onBack,
  onSkip,
  totalSteps,
}: StepPieceProps) {
  const appendTranscript = (text: string) => {
    onChange(value ? `${value.trimEnd()} ${text}` : text)
  }

  return (
    <WizardFrame
      step={4}
      totalSteps={totalSteps}
      title="Anything you're working on?"
      subtitle="Name a piece and we'll add it to your repertoire. Optional — you can add pieces any time."
      action={{ label: 'Back', onClick: onBack }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onNext()
        }}
      >
        <div className="flex items-center gap-md">
          <TextInput
            aria-label="Piece you're working on"
            autoFocus
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="e.g. Bruch concerto, Autumn Leaves, fiddle tune you're learning…"
          />
          <VoiceInput
            onTranscript={appendTranscript}
            aria-label="Dictate the piece name"
          />
        </div>
        <p className={`${WIZARD_HINT} mt-md`}>
          Just the name for now — spots and details come later, while you
          practice.
        </p>

        <Button type="submit" fullWidth className="mt-2xl">
          Next
        </Button>
      </form>

      <button type="button" onClick={onSkip} className={`${WIZARD_LINK} mt-md`}>
        Skip — I&apos;ll add later
      </button>
    </WizardFrame>
  )
}
