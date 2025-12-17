'use client'

import type { AnalyticsSummary as AnalyticsSummaryType } from '@/lib/types'

interface AnalyticsSummaryProps {
  analytics: AnalyticsSummaryType
}

export default function AnalyticsSummary({ analytics }: AnalyticsSummaryProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div className="bg-gradient-to-br from-primary-500 to-primary-700 text-white rounded-xl p-6 text-center">
        <h3 className="text-5xl font-bold mb-2">{analytics.total_sessions}</h3>
        <p className="text-primary-100">Total Sessions</p>
      </div>
      <div className="bg-gradient-to-br from-primary-500 to-primary-700 text-white rounded-xl p-6 text-center">
        <h3 className="text-5xl font-bold mb-2">{analytics.total_minutes}</h3>
        <p className="text-primary-100">Total Minutes</p>
      </div>
      <div className="bg-gradient-to-br from-primary-500 to-primary-700 text-white rounded-xl p-6 text-center">
        <h3 className="text-5xl font-bold mb-2">{analytics.average_duration.toFixed(0)}</h3>
        <p className="text-primary-100">Avg Duration (min)</p>
      </div>
    </div>
  )
}


