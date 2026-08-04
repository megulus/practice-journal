import type { ReactNode } from 'react'

/**
 * Uppercase section label used between the Profile tab's sections.
 *
 * Deliberately the same utilities as the Plans list's group headings
 * (`text-xs`/`tracking-wide`) rather than an exact match for the `label` token
 * in design-tokens §3 (11px / 0.8px) — the two screens sit next to each other
 * in the nav, so matching the neighbor beats being 1px closer to the token.
 * Retoning both is its own change.
 */
export function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-md text-xs font-medium uppercase tracking-wide text-text-tertiary">
      {children}
    </h2>
  )
}
