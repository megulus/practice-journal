'use client'

import { useClerk, useUser } from '@clerk/nextjs'
import { getUserDisplay } from '@/components/layout/userDisplay'

/**
 * Compact account row at the top of the Profile tab (spec §5.8): initials
 * avatar, display name, email, and a "Manage account" link.
 *
 * Clerk owns everything behind that link — password changes, connected
 * accounts, profile edits — so this surface deliberately renders identity
 * read-only and hands off rather than duplicating those forms.
 */
export function AccountHeader() {
  const { user } = useUser()
  const { openUserProfile } = useClerk()
  const { name, email, initials } = getUserDisplay(user)

  return (
    <div className="flex items-center gap-lg border-b border-border-default pb-xl">
      <span
        aria-hidden
        className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-round bg-card-bg-inset text-sm font-semibold text-text-secondary"
      >
        {initials}
      </span>

      <div className="min-w-0">
        <p className="truncate font-semibold text-text-primary">{name}</p>
        {email && (
          <p className="truncate text-sm text-text-secondary">{email}</p>
        )}
        <button
          type="button"
          onClick={() => openUserProfile()}
          className="text-sm text-text-link transition-colors hover:text-text-primary"
        >
          Manage account
        </button>
      </div>
    </div>
  )
}
