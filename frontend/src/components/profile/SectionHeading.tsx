import type { ReactNode } from 'react'

/**
 * Uppercase section label used between the Profile tab's sections
 * (design tokens §3, `label`: 11px / 500 / 0.8px). Matches the grouping
 * headings on the Plans list.
 */
export function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-md text-xs font-medium uppercase tracking-wide text-text-tertiary">
      {children}
    </h2>
  )
}
