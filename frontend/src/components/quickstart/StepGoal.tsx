'use client'

import { Button, TextInput } from '@/components/ui'
import { WizardFrame, WIZARD_HINT, WIZARD_LINK } from './WizardFrame'

export interface StepGoalProps {
  value: string
  onChange: (value: string) => void
  onNext: () => void
  onBack: () => void
  /** "I'm not sure yet" — clears the goal and moves on with a generic plan. */
  onSkip: () => void
  totalSteps: number
}

/**
 * Step 2 — "What are you working on right now?" (spec §5.6). The answer
 * becomes the plan name; skipping generates a generic plan instead.
 */
export function StepGoal({
  value,
  onChange,
  onNext,
  onBack,
  onSkip,
  totalSteps,
}: StepGoalProps) {
  const canContinue = value.trim().length > 0

  return (
    <WizardFrame
      step={2}
      totalSteps={totalSteps}
      title="What are you working on right now?"
      subtitle="A piece, a technique, or just general improvement — anything goes."
      action={{ label: 'Back', onClick: onBack }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (canContinue) onNext()
        }}
      >
        <TextInput
          aria-label="What are you working on right now?"
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. Bruch Violin Concerto, sight-reading…"
        />
        <p className={`${WIZARD_HINT} mt-md`}>
          This becomes the name of your first practice plan. You can change it
          anytime.
        </p>

        <Button
          type="submit"
          fullWidth
          className="mt-2xl"
          disabled={!canContinue}
        >
          Next
        </Button>
      </form>

      <button type="button" onClick={onSkip} className={`${WIZARD_LINK} mt-md`}>
        I&apos;m not sure yet — just get me started
      </button>
    </WizardFrame>
  )
}
