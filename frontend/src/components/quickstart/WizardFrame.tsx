'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { Card } from '@/components/ui'
import { cx } from '@/lib/cx'

/**
 * Shared chrome for every quick-start step: wordmark bar with a single
 * top-right action, progress dots, question, hint, then the step's own body.
 * Matches docs/wireframes/quickstart-step1.png … step4.png.
 */

/** Typography from design-tokens §3 — heading-lg, body, label. */
export const WIZARD_HEADING =
  'text-[24px] font-semibold leading-[1.35] tracking-[-0.5px] text-text-primary'
export const WIZARD_SUBTITLE = 'text-[13px] leading-[1.5] text-text-secondary'
export const WIZARD_HINT = 'text-[11px] leading-[1.4] text-text-tertiary'
export const WIZARD_LABEL =
  'text-[11px] font-medium uppercase leading-[1.4] tracking-[0.8px] text-text-secondary'
/** Secondary text link under a step's primary button ("Skip", "Not sure yet"). */
export const WIZARD_LINK =
  'block w-full py-2 text-center text-[13px] leading-[1.5] text-text-link transition-colors hover:text-text-primary disabled:opacity-50'

export interface WizardFrameProps {
  step: number
  totalSteps: number
  title: string
  subtitle?: string
  /** Top-right action — "Skip setup" on step 1, "Back" afterwards. */
  action?: { label: string; onClick: () => void }
  /**
   * The wordmark stands in for the app header while the nav is hidden. Steps
   * that run with the nav visible (step 5) drop it rather than showing it twice.
   */
  showWordmark?: boolean
  children: ReactNode
}

export function WizardFrame({
  step,
  totalSteps,
  title,
  subtitle,
  action,
  showWordmark = true,
  children,
}: WizardFrameProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  // Advancing a step swaps the whole card out, which would otherwise drop
  // focus to <body>: nothing announces the new question and tab order restarts
  // at the top of the document. Move focus to the new heading instead — but
  // only when nothing else has claimed it, so the steps whose field carries
  // `autoFocus` (goal, piece) still open ready to type. React applies
  // `autoFocus` during commit, before this effect runs, so the check is
  // reliable rather than a race.
  useEffect(() => {
    const active = document.activeElement
    if (!active || active === document.body) headingRef.current?.focus()
  }, [step])

  return (
    <Card style={{ padding: 0 }} className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border-default px-4xl py-lg">
        {showWordmark ? (
          <span
            className="font-wordmark text-text-primary"
            style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.3px' }}
          >
            Kantelo
          </span>
        ) : (
          <span aria-hidden="true" />
        )}
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="text-[13px] leading-[1.5] text-text-link transition-colors hover:text-text-primary"
          >
            {action.label}
          </button>
        )}
      </div>

      <div className="px-4xl py-3xl">
        <StepDots total={totalSteps} current={step} className="mb-2xl" />
        {/* tabIndex -1 makes the heading programmatically focusable without
            adding it to the tab order; the focus ring is redundant on a
            heading the user never tabbed to. */}
        <h1
          ref={headingRef}
          tabIndex={-1}
          className={cx(WIZARD_HEADING, 'outline-none')}
        >
          {title}
        </h1>
        {subtitle && <p className={cx(WIZARD_SUBTITLE, 'mt-md')}>{subtitle}</p>}
        <div className="mt-2xl">{children}</div>
      </div>
    </Card>
  )
}

export function StepDots({
  total,
  current,
  className,
}: {
  total: number
  current: number
  className?: string
}) {
  return (
    <div
      role="img"
      aria-label={`Step ${current} of ${total}`}
      className={cx('flex items-center justify-center gap-sm', className)}
    >
      {Array.from({ length: total }, (_, i) => {
        const position = i + 1
        return (
          <span
            key={position}
            aria-hidden="true"
            className={cx(
              'h-1.5 w-1.5 rounded-round transition-colors',
              position === current
                ? 'bg-primary'
                : position < current
                  ? 'bg-primary-subtle-border'
                  : 'bg-border-input',
            )}
          />
        )
      })}
    </div>
  )
}
