'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import type { Instrument, PracticeTemplate, PracticeLog, AnalyticsSummary as AnalyticsType } from '@/lib/types'
import AnalyticsSummary from '@/components/AnalyticsSummary'
import HistoryCard from '@/components/HistoryCard'

export default function HistoryPage() {
  const params = useParams()
  const router = useRouter()
  const instrumentName = params.instrument as string
  const [template, setTemplate] = useState<PracticeTemplate | null>(null)
  const [logs, setLogs] = useState<PracticeLog[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsType | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.getInstruments(), api.getTemplates()])
      .then(([instruments, allTemplates]) => {
        const inst = instruments.find(
          (i) => i.name.toLowerCase() === instrumentName.toLowerCase()
        )
        if (inst) {
          const tmpl = allTemplates.find(
            (t) => t.instrument_id === inst.id && t.is_active
          )
          if (tmpl) {
            return Promise.all([
              api.getTemplate(tmpl.id),
              api.getLogs(tmpl.id),
              api.getAnalytics(tmpl.id),
            ])
          }
        }
        return [null, [], null]
      })
      .then(([tmpl, logsData, analyticsData]) => {
        if (tmpl) {
          setTemplate(tmpl)
          setLogs(logsData)
          setAnalytics(analyticsData)
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
          <p className="text-center text-gray-600">Loading history...</p>
        </div>
      </main>
    )
  }

  if (!template) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-primary-100 to-secondary-100 p-8">
        <div className="max-w-6xl mx-auto">
          <p className="text-center text-red-600">No active template found</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-primary-100 to-secondary-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-br from-purple-500 to-purple-700 text-white p-8 text-center">
            <h1 className="text-4xl font-bold mb-2">📊 Practice History</h1>
            <p className="text-purple-100 text-lg">Your progress over time</p>
          </div>

          <div className="p-8">
            {analytics && <AnalyticsSummary analytics={analytics} />}

            <h2 className="text-2xl font-bold text-gray-800 mb-6">Recent Sessions</h2>

            {logs.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg">No practice logs yet.</p>
                <p className="mt-2">Start logging your sessions to see your progress here!</p>
              </div>
            ) : (
              <div>
                {logs.map((log) => {
                  const dayData = template.practice_days?.find(
                    (d) => d.day_number === log.day_number
                  )
                  return (
                    <HistoryCard
                      key={log.id}
                      log={log}
                      dayTitle={dayData?.title}
                    />
                  )
                })}
              </div>
            )}

            <div className="mt-8 text-center">
              <button
                onClick={() => router.push(`/${instrumentName}`)}
                className="text-primary-600 hover:text-primary-700 font-semibold"
              >
                ← Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}


