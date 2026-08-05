'use client'

import SignOutButton from '@/components/SignOutButton'
import { AccountHeader } from '@/components/profile/AccountHeader'
import { InstrumentManager } from '@/components/profile/InstrumentManager'
import { ProfileSettings } from '@/components/profile/ProfileSettings'
import { SectionHeading } from '@/components/profile/SectionHeading'

export default function ProfilePage() {
  return (
    <div className="space-y-2xl">
      <h1 className="text-2xl font-semibold text-text-primary">Profile</h1>

      <AccountHeader />

      <section>
        <SectionHeading>My instruments</SectionHeading>
        <InstrumentManager />
      </section>

      <ProfileSettings />

      <div className="border-t border-border-default pt-xl">
        <SignOutButton />
      </div>
    </div>
  )
}
