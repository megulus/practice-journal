'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import type { Instrument, PracticeTemplate } from '@/lib/types'

export default function InstrumentPage() {
  const params = useParams()
  const router = useRouter()
  const instrumentName = params.instrument as string
  const [instrument, setInstrument] = useState<Instrument | null>(null)
  const [templates, setTemplates] = useState<PracticeTemplate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.getInstruments(), api.getTemplates()])
      .then(([instruments, allTemplates]) => {
        const inst = instruments.find(
          (i) => i.name.toLowerCase() === instrumentName.toLowerCase()
        )
        if (inst) {
          setInstrument(inst)
          setTemplates(allTemplates.filter((t) => t.instrument_id === inst.id))
        }
        setLoading(false)
      })
      .catch((err) => {
        console.error(err)
        setLoading(false)
      })
  }, [instrumentName])

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-primary-100 to-secondary-100 p-8">
        <div className="max-w-6xl mx-auto">
          <p className="text-center text-gray-600">Loading...</p>
        </div>
      </main>
    )
  }

  if (!instrument) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-primary-100 to-secondary-100 p-8">
        <div className="max-w-6xl mx-auto">
          <p className="text-center text-red-600">Instrument not found</p>
        </div>
      </main>
    )
  }

  const activeTemplate = templates.find((t) => t.is_active)

  return (
    <main className="min-h-screen bg-gradient-to-br from-primary-100 to-secondary-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-br from-primary-500 to-primary-700 text-white p-8 text-center">
            <h1 className="text-4xl font-bold mb-2">🎻 {instrument.name} Practice Tracker</h1>
            {activeTemplate && (
              <p className="text-primary-100 text-lg">{activeTemplate.name}</p>
            )}
          </div>

          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => router.push(`/${instrumentName}/plan`)}
                className="p-6 bg-gradient-to-br from-primary-500 to-primary-600 text-white rounded-lg shadow-md hover:shadow-xl transition-all hover:scale-105"
              >
                <h2 className="text-2xl font-bold mb-2">📅 Practice Plan</h2>
                <p className="text-primary-100">View your rotation schedule</p>
              </button>

              <button
                onClick={() => router.push(`/${instrumentName}/log`)}
                className="p-6 bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg shadow-md hover:shadow-xl transition-all hover:scale-105"
              >
                <h2 className="text-2xl font-bold mb-2">✏️ Log Practice</h2>
                <p className="text-green-100">Record today's session</p>
              </button>

              <button
                onClick={() => router.push(`/${instrumentName}/history`)}
                className="p-6 bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg shadow-md hover:shadow-xl transition-all hover:scale-105"
              >
                <h2 className="text-2xl font-bold mb-2">📊 History</h2>
                <p className="text-purple-100">View past sessions & stats</p>
              </button>
            </div>

            <div className="mt-8 text-center">
              <button
                onClick={() => router.push('/')}
                className="text-primary-600 hover:text-primary-700 font-semibold"
              >
                ← Back to Instruments
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}


