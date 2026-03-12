'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useApi } from '@/lib/useApi'
import DashboardSuggestions from '@/components/DashboardSuggestions'
import type { UserInstrument, PracticeTemplate } from '@/lib/types'

export default function InstrumentPage() {
  const params = useParams()
  const router = useRouter()
  const api = useApi()
  const instrumentName = params.instrument as string
  const [userInstrument, setUserInstrument] = useState<UserInstrument | null>(null)
  const [templates, setTemplates] = useState<PracticeTemplate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getUserInstruments()
      .then(async (userInstruments) => {
        const ui = userInstruments.find(
          (ui) => ui.instrument.name.toLowerCase() === instrumentName.toLowerCase()
        )
        if (ui) {
          setUserInstrument(ui)
          const allTemplates = await api.getTemplates(ui.id)
          setTemplates(allTemplates)
        }
        setLoading(false)
      })
      .catch((err) => {
        console.error(err)
        setLoading(false)
      })
  }, [instrumentName, api])

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-primary-100 to-secondary-100 p-8">
        <div className="max-w-6xl mx-auto">
          <p className="text-center text-gray-600">Loading...</p>
        </div>
      </main>
    )
  }

  if (!userInstrument) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-primary-100 to-secondary-100 p-8">
        <div className="max-w-6xl mx-auto">
          <p className="text-center text-red-600">Instrument not found</p>
          <button
            onClick={() => router.push('/me')}
            className="mt-4 mx-auto block text-primary-600 hover:text-primary-800"
          >
            Go to My Instruments
          </button>
        </div>
      </main>
    )
  }

  const activeTemplate = templates.find((t) => t.is_active)

  return (
    <main className="min-h-screen bg-gradient-to-br from-primary-100 to-secondary-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-4">
          <button
            onClick={() => router.push('/me')}
            className="text-primary-600 hover:text-primary-800 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            My Instruments
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-br from-primary-500 to-primary-700 text-white p-8 text-center">
            <h1 className="text-4xl font-bold mb-2">{userInstrument.instrument.name} Practice Tracker</h1>
            {activeTemplate && (
              <p className="text-primary-100 text-lg">{activeTemplate.name}</p>
            )}
          </div>

          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <button
                onClick={() => router.push(`/${instrumentName}/plan`)}
                className="p-6 bg-gradient-to-br from-primary-500 to-primary-600 text-white rounded-lg shadow-md hover:shadow-xl transition-all hover:scale-105"
              >
                <h2 className="text-2xl font-bold mb-2">Practice Plan</h2>
                <p className="text-primary-100">View your rotation schedule</p>
              </button>

              <button
                onClick={() => router.push(`/${instrumentName}/log`)}
                className="p-6 bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg shadow-md hover:shadow-xl transition-all hover:scale-105"
              >
                <h2 className="text-2xl font-bold mb-2">Log Practice</h2>
                <p className="text-green-100">Record today&apos;s session</p>
              </button>

              <button
                onClick={() => router.push(`/${instrumentName}/history`)}
                className="p-6 bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg shadow-md hover:shadow-xl transition-all hover:scale-105"
              >
                <h2 className="text-2xl font-bold mb-2">History</h2>
                <p className="text-purple-100">View past sessions & stats</p>
              </button>

              <button
                onClick={() => router.push(`/${instrumentName}/template/edit`)}
                className="p-6 bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-lg shadow-md hover:shadow-xl transition-all hover:scale-105"
              >
                <h2 className="text-2xl font-bold mb-2">Edit Template</h2>
                <p className="text-amber-100">
                  {activeTemplate ? 'Customize your plan' : 'Create a practice plan'}
                </p>
              </button>
            </div>

            <DashboardSuggestions
              instrumentId={userInstrument.instrument.id}
              instrumentName={instrumentName}
              api={api}
            />
          </div>
        </div>
      </div>
    </main>
  )
}
