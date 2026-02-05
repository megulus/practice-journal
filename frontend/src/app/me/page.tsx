'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useApi } from '@/lib/useApi'
import { useUser } from '@clerk/nextjs'
import type { UserInstrument, Instrument } from '@/lib/types'

export default function MePage() {
  const [userInstruments, setUserInstruments] = useState<UserInstrument[]>([])
  const [availableInstruments, setAvailableInstruments] = useState<Instrument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addingInstrumentId, setAddingInstrumentId] = useState<number | null>(null)
  const [removingId, setRemovingId] = useState<number | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<UserInstrument | null>(null)
  const router = useRouter()
  const api = useApi()
  const { isLoaded, isSignedIn } = useUser()

  // Track if user was ever signed in during this session
  const wasSignedIn = useRef(false)
  if (isSignedIn) {
    wasSignedIn.current = true
  }

  // Prevent duplicate fetches when dependencies change
  const hasFetched = useRef(false)

  const fetchData = async () => {
    try {
      // Use combined endpoint to avoid two auth round-trips
      const data = await api.getUserInstrumentsWithAvailable()
      setUserInstruments(data.user_instruments)
      setAvailableInstruments(data.available_instruments)
      setLoading(false)
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) {
      router.push('/sign-in')
      return
    }
    if (hasFetched.current) return
    hasFetched.current = true
    fetchData()
  }, [isLoaded, isSignedIn, router, api])

  const handleAddInstrument = async (instrumentId: number) => {
    if (addingInstrumentId !== null) return
    setAddingInstrumentId(instrumentId)
    try {
      await api.addUserInstrument(instrumentId)
      await fetchData()
      setShowAddModal(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setAddingInstrumentId(null)
    }
  }

  const handleRemoveInstrument = async (userInstrument: UserInstrument, confirmed = false) => {
    if (userInstrument.template_count > 0 && !confirmed) {
      setConfirmRemove(userInstrument)
      return
    }

    setRemovingId(userInstrument.id)
    setConfirmRemove(null)
    try {
      await api.removeUserInstrument(userInstrument.id, confirmed)
      await fetchData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setRemovingId(null)
    }
  }

  // If user was signed in and is now signing out (Clerk updating or signed out), show blank background
  // This prevents the jarring "My Instruments" loading state during sign-out
  if (wasSignedIn.current && (!isLoaded || !isSignedIn)) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-primary-100 to-secondary-100">
      </main>
    )
  }

  if (!isLoaded || loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-primary-100 to-secondary-100 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-8 text-primary-700">My Instruments</h1>
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
          <h1 className="text-4xl font-bold mb-8 text-primary-700">My Instruments</h1>
          <div className="bg-red-50 rounded-xl shadow-xl p-8">
            <p className="text-center text-red-600">Error: {error}</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-primary-100 to-secondary-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-primary-700">My Instruments</h1>
          {availableInstruments.length > 0 && (
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Instrument
            </button>
          )}
        </div>

        {userInstruments.length === 0 ? (
          <div className="bg-white rounded-xl shadow-xl p-8 text-center">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800">Welcome!</h2>
            <p className="text-gray-600 mb-6">
              Get started by adding an instrument to your practice journal.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Add Your First Instrument
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {userInstruments.map((ui) => (
              <div
                key={ui.id}
                className="bg-white rounded-xl shadow-lg overflow-hidden"
              >
                <button
                  onClick={() => router.push(`/${ui.instrument.name.toLowerCase()}`)}
                  className="w-full p-6 bg-gradient-to-br from-primary-500 to-primary-600 text-white text-left hover:from-primary-600 hover:to-primary-700 transition-all"
                >
                  <h3 className="text-2xl font-bold mb-1">{ui.instrument.name}</h3>
                  {ui.instrument.description && (
                    <p className="text-primary-100 text-sm">{ui.instrument.description}</p>
                  )}
                  <p className="text-primary-200 text-xs mt-2">
                    {ui.template_count} {ui.template_count === 1 ? 'template' : 'templates'}
                  </p>
                </button>
                <div className="px-4 py-2 bg-gray-50 flex justify-end">
                  <button
                    onClick={() => handleRemoveInstrument(ui)}
                    disabled={removingId === ui.id}
                    className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                  >
                    {removingId === ui.id ? 'Removing...' : 'Remove'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Instrument Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">Add Instrument</h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {availableInstruments.length === 0 ? (
                <p className="text-gray-500 text-center">No more instruments available to add.</p>
              ) : (
                <div className="grid gap-3">
                  {availableInstruments.map((instrument) => {
                    const isAdding = addingInstrumentId === instrument.id
                    return (
                      <button
                        key={instrument.id}
                        onClick={() => handleAddInstrument(instrument.id)}
                        disabled={addingInstrumentId !== null}
                        className={`p-4 border rounded-lg text-left transition-all ${
                          addingInstrumentId !== null
                            ? 'opacity-70 cursor-not-allowed'
                            : 'hover:border-primary-500 hover:bg-primary-50'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="font-semibold text-gray-800">{instrument.name}</h3>
                            {instrument.description && (
                              <p className="text-sm text-gray-500">{instrument.description}</p>
                            )}
                          </div>
                          {isAdding && (
                            <svg
                              className="animate-spin h-5 w-5 text-primary-600"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              />
                            </svg>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm Remove Modal */}
      {confirmRemove && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Remove Instrument?</h2>
            <p className="text-gray-600 mb-4">
              Removing <strong>{confirmRemove.instrument.name}</strong> will also delete{' '}
              <strong>{confirmRemove.template_count}</strong>{' '}
              {confirmRemove.template_count === 1 ? 'template' : 'templates'}.
            </p>
            <p className="text-red-600 text-sm mb-6">This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmRemove(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRemoveInstrument(confirmRemove, true)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Remove Instrument
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
