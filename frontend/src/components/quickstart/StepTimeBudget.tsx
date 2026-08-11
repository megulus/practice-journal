'use client'

import { Button, useRovingFocus } from '@/components/ui'
import { cx } from '@/lib/cx'
import { TIME_BUDGETS, type QuickStartPlan } from '@/lib/quickstart'
import { PlanPreview } from './PlanPreview'
import { WizardFrame, WIZARD_LINK } from './WizardFrame'

export interface StepTimeBudgetProps {
  minutes: number
  onMinutesChange: (minutes: number) => void
  plan: QuickStartPlan
  instrumentName: string
  onStart: () => void
  onSave: () => void
  onCustomize: () => void
  onBack: () => void
  /** Which action is in flight, if any — keeps the buttons honest. */
  pending: 'start' | 'save' | 'customize' | null
  error?: string | null
  totalSteps: number
}

/**
 * Step 5 — "How much time today?" plus the generated plan preview (spec §5.6).
 * The three exits: start practicing now, save the plan for later, or open the
 * plan editor to customize it.
 */
export function StepTimeBudget({
  minutes,
  onMinutesChange,
  plan,
  instrumentName,
  onStart,
  onSave,
  onCustomize,
  onBack,
  pending,
  error,
  totalSteps,
}: StepTimeBudgetProps) {
  const busy = pending !== null

  // Two-line cards in a 4-up grid, so `PillRadioGroup` doesn't fit — but the
  // radiogroup keyboard contract is the same one every other group in the app
  // honors (#263, #278), so it comes from the same hook.
  const { checkedIndex, tabStopIndex, handleKeyDown, itemRef } = useRovingFocus<
    number,
    HTMLButtonElement
  >({
    values: [...TIME_BUDGETS],
    value: minutes,
    onChange: onMinutesChange,
  })

  return (
    <WizardFrame
      step={5}
      totalSteps={totalSteps}
      title="How much time today?"
      subtitle="We'll balance your sections to fit. You can adjust this every session."
      action={{ label: 'Back', onClick: onBack }}
      // The nav (and its wordmark) is back on this step — spec §5.6.
      showWordmark={false}
    >
      <div
        role="radiogroup"
        aria-label="Time budget"
        onKeyDown={handleKeyDown}
        className="grid grid-cols-4 gap-md"
      >
        {TIME_BUDGETS.map((budget, index) => {
          const selected = index === checkedIndex
          return (
            <button
              key={budget}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${budget} min`}
              tabIndex={index === tabStopIndex ? 0 : -1}
              ref={itemRef(index)}
              onClick={() => onMinutesChange(budget)}
              className={cx(
                'flex flex-col items-center rounded-lg border py-lg transition-colors',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                selected
                  ? 'border-primary-subtle-border bg-primary-subtle-bg text-primary-subtle-text'
                  : 'border-border-input text-text-primary hover:bg-card-bg-inset',
              )}
            >
              <span className="text-[18px] font-semibold leading-[1.35] tracking-[-0.3px]">
                {budget}
              </span>
              <span className="text-[11px] leading-[1.4] text-text-secondary">
                min
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-2xl">
        <PlanPreview
          plan={plan}
          instrumentName={instrumentName}
          onCustomize={onCustomize}
          customizeDisabled={busy}
        />
      </div>

      {error && (
        <p role="alert" className="mt-lg text-[13px] leading-[1.5] text-danger-text">
          {error}
        </p>
      )}

      <Button fullWidth className="mt-2xl" disabled={busy} onClick={onStart}>
        {pending === 'start' ? 'Starting…' : 'Start practicing'}
      </Button>

      <button
        type="button"
        onClick={onSave}
        disabled={busy}
        className={`${WIZARD_LINK} mt-md`}
      >
        {pending === 'save' ? 'Saving…' : 'Save plan and practice later'}
      </button>
    </WizardFrame>
  )
}
