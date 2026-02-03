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

  return (
    <main className="min-h-screen bg-gradient-to-br from-primary-100 to-secondary-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl font-bold mb-4 text-center text-primary-700">
          Practice Journal
        </h1>
        <p className="text-center text-gray-600 mb-8 text-lg">
          Track your music practice across multiple instruments
        </p>
        <div className="bg-white rounded-xl shadow-xl p-8">
          <p className="text-center text-gray-500">Loading...</p>
        </div>
      </div>
    </main>
  )
}
