'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'

export default function Home() {
  const router = useRouter()
  const { isLoaded, isSignedIn } = useUser()

  useEffect(() => {
    if (!isLoaded) return

    if (isSignedIn) {
      router.push('/me')
    } else {
      router.push('/sign-in')
    }
  }, [isLoaded, isSignedIn, router])

  // Show minimal UI while determining redirect destination
  return (
    <main className="min-h-screen bg-gradient-to-br from-primary-100 to-secondary-100">
    </main>
  )
}
