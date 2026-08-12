'use client'

import { Button, Checkbox } from '@/components/ui'
import { cx } from '@/lib/cx'
import { QUICK_START_AREAS } from '@/lib/quickstart'
import type { SectionType } from '@/lib/types'
import { WizardFrame, WIZARD_HINT } from './WizardFrame'

export interface StepAreasProps {
  selected: SectionType[]
  onToggle: (type: SectionType) => void
  onNext: () => void
  onBack: () => void
  totalSteps: number
}

/**
 * Step 3 — "What should a session include?" (spec §5.6). Warm-up, scales,
 * repertoire and cool-down come pre-selected; the plan is balanced from
 * whatever is checked here.
 */
export function StepAreas({
  selected,
  onToggle,
  onNext,
  onBack,
  totalSteps,
}: StepAreasProps) {
  const canContinue = selected.length > 0

  return (
    <WizardFrame
      step={3}
      totalSteps={totalSteps}
      title="What should a session include?"
      subtitle="Select the areas you want to cover. We'll build a balanced plan from these."
      action={{ label: 'Back', onClick: onBack }}
    >
      <div className="flex flex-col gap-md">
        {QUICK_START_AREAS.map((area) => {
          const checked = selected.includes(area.type)
          return (
            <Checkbox
              key={area.type}
              label={area.label}
              checked={checked}
              onChange={() => onToggle(area.type)}
              className={cx(
                'w-full rounded-lg border px-lg py-lg transition-colors',
                checked
                  ? 'border-primary-subtle-border bg-primary-subtle-bg'
                  : 'border-border-input bg-transparent',
              )}
            />
          )
        })}
      </div>

      {!canContinue && (
        <p role="status" className={`${WIZARD_HINT} mt-lg`}>
          Pick at least one area to build a plan from.
        </p>
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
