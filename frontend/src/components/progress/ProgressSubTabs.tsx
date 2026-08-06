'use client'

import { useRef } from 'react'
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
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Arrow keys move between tabs (ARIA tabs pattern); Home/End jump to the
  // ends. Selection follows focus, which is the right call here — switching
  // sub-tabs is cheap and has no destructive side effect.
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    const delta =
      e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    let next: number
    if (delta !== 0) {
      next = (index + delta + TABS.length) % TABS.length
    } else if (e.key === 'Home') {
      next = 0
    } else if (e.key === 'End') {
      next = TABS.length - 1
    } else {
      return
    }
    e.preventDefault()
    onChange(TABS[next].value)
    tabRefs.current[next]?.focus()
  }

  return (
    <div role="tablist" aria-label="Progress view" className="flex gap-lg border-b border-border-default">
      {TABS.map((tab, index) => {
        const active = tab.value === value
        return (
          <button
            key={tab.value}
            ref={(el) => {
              tabRefs.current[index] = el
            }}
            type="button"
            role="tab"
            id={`progress-tab-${tab.value}`}
            aria-selected={active}
            // Only the selected panel is rendered, so pointing at the other
            // one would be a dangling reference.
            aria-controls={active ? `progress-panel-${tab.value}` : undefined}
            tabIndex={active ? 0 : -1}
            onKeyDown={(e) => handleKeyDown(e, index)}
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
