'use client'

import type { ReactNode } from 'react'
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
        <h1 className={WIZARD_HEADING}>{title}</h1>
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
