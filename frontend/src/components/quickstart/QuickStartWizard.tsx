'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApi } from '@/lib/useApi'
import { useHideAppChrome } from '@/components/layout/appChrome'
import {
  DEFAULT_AREA_TYPES,
  DEFAULT_TIME_BUDGET,
  buildQuickStartPlan,
} from '@/lib/quickstart'
import type { Instrument, SectionType } from '@/lib/types'
import { StepAreas } from './StepAreas'
import { StepGoal } from './StepGoal'
import { StepInstrument } from './StepInstrument'
import { StepPiece } from './StepPiece'
import { StepTimeBudget } from './StepTimeBudget'
import {
  resolveInstrument,
  type InstrumentSelection,
} from './instrumentSelection'

const TOTAL_STEPS = 5

type PendingAction = 'start' | 'save' | 'customize'

export interface QuickStartWizardProps {
  /** Instruments the user already has (usually none). */
  instruments: Instrument[]
  /**
   * Where step 1 starts. Set when the wizard was opened from a specific
   * instrument's card, so the plan lands on the one the user was looking at.
   * Still editable — it's a starting point, not a lock.
   */
  initialSelection?: InstrumentSelection | null
  /** "Skip setup" — hand the user back to the ordinary Today content. */
  onSkip: () => void
  /** A plan was saved without starting a session; Today should reload. */
  onSaved: () => void
}

/**
 * Quick-start wizard (product spec §5.6) — five steps from nothing to
 * practicing: instrument → goal → session areas → current piece → time budget
 * and plan preview.
 *
 * Nothing is written until one of step 5's exits is taken; that single
 * `POST /api/quickstart` creates the instrument, the optional first piece, and
 * the active plan together.
 */
export function QuickStartWizard({
  instruments,
  initialSelection = null,
  onSkip,
  onSaved,
}: QuickStartWizardProps) {
  const api = useApi()
  const router = useRouter()

  const [step, setStep] = useState(1)
  const [selection, setSelection] = useState<InstrumentSelection | null>(
    initialSelection,
  )
  const [otherName, setOtherName] = useState('')
  const [goal, setGoal] = useState('')
  const [areas, setAreas] = useState<SectionType[]>(DEFAULT_AREA_TYPES)
  const [pieceName, setPieceName] = useState('')
  const [minutes, setMinutes] = useState<number>(DEFAULT_TIME_BUDGET)
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Steps 1–4 are pre-app onboarding: no nav. It returns on step 5, where the
  // user is "in" the app (spec §5.6).
  useHideAppChrome(step < TOTAL_STEPS)

  const instrument = resolveInstrument(selection, instruments, otherName)

  const plan = useMemo(
    () =>
      buildQuickStartPlan({
        areaTypes: areas,
        minutes,
        planName: goal,
        pieceName,
      }),
    [areas, minutes, goal, pieceName],
  )

  const toggleArea = (type: SectionType) => {
    setAreas((current) =>
      current.includes(type)
        ? current.filter((t) => t !== type)
        : [...current, type],
    )
  }

  const submit = async (action: PendingAction) => {
    if (!instrument) return
    setPending(action)
    setError(null)
    try {
      const result = await api.quickStart({
        instrument_id: instrument.id,
        instrument_name: instrument.id ? undefined : instrument.name,
        plan_name: plan.name,
        piece_name: pieceName.trim() || undefined,
        sections: plan.sections,
      })

      if (action === 'start') {
        // Reuse the guarded start route so a session is created exactly once.
        router.push(
          `/session/start?instrument=${result.instrument.id}` +
            `&template=${result.template.id}` +
            `&session=${result.template_session_id}`,
        )
      } else if (action === 'customize') {
        router.push(`/plans/${result.template.id}`)
      } else {
        onSaved()
      }
      // Leave `pending` set on success — the surface is on its way out and the
      // buttons should stay disabled until it goes.
    } catch (err) {
      setError(
        err instanceof Error
          ? `Couldn't create your plan: ${err.message}`
          : "Couldn't create your plan",
      )
      setPending(null)
    }
  }

  if (step === 1) {
    return (
      <StepInstrument
        instruments={instruments}
        selection={selection}
        onSelect={setSelection}
        otherName={otherName}
        onOtherNameChange={setOtherName}
        canContinue={instrument !== null}
        onNext={() => setStep(2)}
        onSkip={onSkip}
        totalSteps={TOTAL_STEPS}
      />
    )
  }

  if (step === 2) {
    return (
      <StepGoal
        value={goal}
        onChange={setGoal}
        onNext={() => setStep(3)}
        onBack={() => setStep(1)}
        onSkip={() => {
          setGoal('')
          setStep(3)
        }}
        totalSteps={TOTAL_STEPS}
      />
    )
  }

  if (step === 3) {
    return (
      <StepAreas
        selected={areas}
        onToggle={toggleArea}
        onNext={() => setStep(4)}
        onBack={() => setStep(2)}
        totalSteps={TOTAL_STEPS}
      />
    )
  }

  if (step === 4) {
    return (
      <StepPiece
        value={pieceName}
        onChange={setPieceName}
        onNext={() => setStep(5)}
        onBack={() => setStep(3)}
        onSkip={() => {
          setPieceName('')
          setStep(5)
        }}
        totalSteps={TOTAL_STEPS}
      />
    )
  }

  return (
    <StepTimeBudget
      minutes={minutes}
      onMinutesChange={setMinutes}
      plan={plan}
      instrumentName={instrument?.name ?? ''}
      onStart={() => submit('start')}
      onSave={() => submit('save')}
      onCustomize={() => submit('customize')}
      onBack={() => setStep(4)}
      pending={pending}
      error={error}
      totalSteps={TOTAL_STEPS}
    />
  )
}
