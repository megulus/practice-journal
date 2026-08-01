'use client'

import { cx } from '@/lib/cx'

export type ProgressSubTab = 'history' | 'insights'

const TABS: { value: ProgressSubTab; label: string }[] = [
  { value: 'history', label: 'History' },
  { value: 'insights', label: 'Insights' },
]

/**
 * History / Insights switcher for the Progress tab (spec §5.7). Underlined
 * tabs rather than pills — the instrument pills sit directly above and two
 * pill rows would read as one control.
 */
export function ProgressSubTabs({
  value,
  onChange,
}: {
  value: ProgressSubTab
  onChange: (tab: ProgressSubTab) => void
}) {
  return (
    <div role="tablist" aria-label="Progress view" className="flex gap-lg border-b border-border-default">
      {TABS.map((tab) => {
        const active = tab.value === value
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            id={`progress-tab-${tab.value}`}
            aria-selected={active}
            aria-controls={`progress-panel-${tab.value}`}
            onClick={() => onChange(tab.value)}
            className={cx(
              '-mb-px border-b-2 px-0.5 pb-2 text-sm font-medium transition-colors',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              active
                ? 'border-primary text-text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary',
            )}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
