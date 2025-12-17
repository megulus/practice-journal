'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import type { Instrument } from '@/lib/types'

export default function Home() {
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    api
      .getInstruments()
      .then((data) => {
        setInstruments(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  if (loading) {
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
            <p className="text-center text-gray-500">Loading instruments...</p>
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
              Error loading instruments: {error}
            </p>
            <p className="text-center text-gray-600 mt-4">
              Make sure the backend server is running.
            </p>
          </div>
        </div>
      </main>
    )
  }

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
            Select Your Instrument
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {instruments.map((instrument) => (
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

