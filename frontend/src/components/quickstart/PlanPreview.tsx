'use client'

import { Card } from '@/components/ui'
import { getSectionColor } from '@/lib/section-colors'
import type { QuickStartPlan } from '@/lib/quickstart'
import { WIZARD_HINT, WIZARD_LABEL } from './WizardFrame'

export interface PlanPreviewProps {
  plan: QuickStartPlan
  instrumentName: string
  /** "Customize this plan" — saves the plan, then opens the plan editor. */
  onCustomize: () => void
  customizeDisabled?: boolean
}

/**
 * The generated plan as the user sees it on step 5: each section with its
 * name, one-line description and time allocation (spec §5.6).
 */
export function PlanPreview({
  plan,
  instrumentName,
  onCustomize,
  customizeDisabled = false,
}: PlanPreviewProps) {
  let nonPinnedIndex = 0

  return (
    <div>
      <p className={`${WIZARD_LABEL} mb-md`}>Your plan for today</p>

      <Card>
        <h2 className="text-[15px] font-semibold leading-[1.35] tracking-[-0.2px] text-text-primary">
          {plan.name}
        </h2>
        <p className={`${WIZARD_HINT} mt-xs`}>
          {instrumentName} · {plan.totalMinutes} minutes ·{' '}
          {plan.sections.length}{' '}
          {plan.sections.length === 1 ? 'section' : 'sections'}
        </p>

        <ul className="mt-lg divide-y divide-border-subtle">
          {plan.sections.map((section) => {
            const pinned =
              section.section_type === 'warmup' ||
              section.section_type === 'cooldown'
            const color = getSectionColor(
              section.section_type,
              pinned ? 0 : nonPinnedIndex,
            )
            if (!pinned) nonPinnedIndex++

            return (
              <li
                key={section.section_type}
                className="flex items-center gap-lg py-lg first:pt-0 last:pb-0"
              >
                <span
                  aria-hidden="true"
                  className="h-8 w-[3px] flex-shrink-0 rounded-sm"
                  style={{ backgroundColor: color.pip }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium leading-[1.5] text-text-primary">
                    {section.name}
                  </span>
                  <span className={`block ${WIZARD_HINT}`}>
                    {section.block.name === section.name
                      ? section.block.description
                      : section.block.name}
                  </span>
                </span>
                <span className="flex-shrink-0 text-[11px] leading-[1.4] text-text-secondary">
                  {section.estimated_duration_minutes} min
                </span>
              </li>
            )
          })}
        </ul>

        <div className="mt-lg text-right">
          <button
            type="button"
            onClick={onCustomize}
            disabled={customizeDisabled}
            className="text-[13px] leading-[1.5] text-text-link transition-colors hover:text-text-primary disabled:opacity-50"
          >
            Customize this plan
          </button>
        </div>
      </Card>
    </div>
  )
}
