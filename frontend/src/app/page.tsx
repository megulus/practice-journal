'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApi } from '@/lib/useApi'
import { useUser } from '@clerk/nextjs'
import type { Instrument } from '@/lib/types'

export default function Home() {
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const router = useRouter()
  const api = useApi()
  const { isLoaded, isSignedIn } = useUser()

  useEffect(() => {
    // Wait for Clerk to load
    if (!isLoaded) return

    // Redirect to sign-in if not authenticated
    if (!isSignedIn) {
      router.push('/sign-in')
      return
    }

    // Fetch instruments
    api
      .getInstruments()
      .then((data) => {
        setInstruments(data)
        
        // Check if user needs onboarding (has no user-owned instruments)
        const userInstruments = data.filter(i => !i.is_system)
        if (userInstruments.length === 0 && data.some(i => i.is_system)) {
          setNeedsOnboarding(true)
        }
        
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [isLoaded, isSignedIn, router, api])

  const handleCopySystemTemplate = async (instrumentId: number) => {
    try {
      // Copy the system instrument
      await api.copyInstrument(instrumentId)
      
      // Refresh instruments list
      const data = await api.getInstruments()
      setInstruments(data)
      setNeedsOnboarding(false)
    } catch (err: any) {
      setError(err.message)
    }
  }

  if (!isLoaded || loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-primary-100 to-secondary-100 p-8">
        <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl font-bold mb-4 text-center text-primary-700">
          🎼 Practice Journal
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

  if (error) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-primary-100 to-secondary-100 p-8">
        <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl font-bold mb-4 text-center text-primary-700">
          🎼 Practice Journal
        </h1>
        <div className="bg-red-50 rounded-xl shadow-xl p-8">
          <p className="text-center text-red-600">
            Error: {error}
          </p>
          <p className="text-center text-gray-600 mt-4">
            Make sure the backend server is running.
          </p>
        </div>
        </div>
      </main>
    )
  }

  // Show onboarding for new users
  if (needsOnboarding) {
    const systemInstruments = instruments.filter(i => i.is_system)
    
    return (
      <main className="min-h-screen bg-gradient-to-br from-primary-100 to-secondary-100 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl font-bold mb-4 text-center text-primary-700">
            🎉 Welcome to Practice Journal!
          </h1>
          <p className="text-center text-gray-600 mb-8 text-lg">
            Get started by choosing an instrument to practice
          </p>
          <div className="bg-white rounded-xl shadow-xl p-8">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800">
              Choose Your Instrument
            </h2>
            <p className="text-gray-600 mb-6">
              Select an instrument to add to your practice journal. We'll set you up with a practice template to get started!
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {systemInstruments.map((instrument: Instrument) => (
                <button
                  key={instrument.id}
                  onClick={() => handleCopySystemTemplate(instrument.id)}
                  className="p-6 bg-gradient-to-br from-primary-500 to-primary-600 text-white rounded-lg shadow-md hover:shadow-xl transition-all hover:scale-105"
                >
                  <h3 className="text-2xl font-bold mb-2">{instrument.name}</h3>
                  {instrument.description && (
                    <p className="text-primary-100">{instrument.description}</p>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    )
  }

  // Regular home page for existing users
  const userInstruments = instruments.filter(i => !i.is_system)

  return (
    <main className="min-h-screen bg-gradient-to-br from-primary-100 to-secondary-100 p-8">
      <div className="max-w-4xl mx-auto">
      <h1 className="text-5xl font-bold mb-4 text-center text-primary-700">
        🎼 Practice Journal
      </h1>
      <p className="text-center text-gray-600 mb-8 text-lg">
        Track your music practice across multiple instruments
      </p>
      <div className="bg-white rounded-xl shadow-xl p-8">
        <h2 className="text-2xl font-semibold mb-6 text-gray-800">
          Your Instruments
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {userInstruments.map((instrument: Instrument) => (
            <button
              key={instrument.id}
              onClick={() => router.push(`/${instrument.name.toLowerCase()}`)}
              className="p-6 bg-gradient-to-br from-primary-500 to-primary-600 text-white rounded-lg shadow-md hover:shadow-xl transition-all hover:scale-105"
            >
              <h3 className="text-2xl font-bold mb-2">{instrument.name}</h3>
              {instrument.description && (
                <p className="text-primary-100">{instrument.description}</p>
              )}
            </button>
          ))}
        </div>
        </div>
      </div>
    </main>
  )
}

