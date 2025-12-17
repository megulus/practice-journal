'use client'

import type { PracticeLog } from '@/lib/types'

interface HistoryCardProps {
  log: PracticeLog
  dayTitle?: string
}

export default function HistoryCard({ log, dayTitle }: HistoryCardProps) {
  const date = new Date(log.practice_date)
  const formattedDate = date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="bg-white rounded-xl p-6 shadow-md mb-4">
      <div className="flex justify-between items-center mb-4 pb-4 border-b-2 border-gray-100">
        <span className="font-semibold text-primary-600 text-lg">{formattedDate}</span>
        <span className="bg-primary-500 text-white px-4 py-2 rounded-full text-sm">
          {log.duration_minutes} min
        </span>
      </div>
      {dayTitle && (
        <p className="font-semibold text-gray-800 mb-2">{dayTitle}</p>
      )}
      {log.notes && (
        <div className="mt-3">
          <p className="font-semibold text-gray-700">Notes:</p>
          <p className="text-gray-600">{log.notes}</p>
        </div>
      )}
      {log.log_details && log.log_details.length > 0 && (
        <div className="mt-3 space-y-2">
          {log.log_details.map((detail) => (
            detail.content && (
              <div key={detail.id}>
                <p className="font-semibold text-gray-700 capitalize">{detail.section_type}:</p>
                <p className="text-gray-600">{detail.content}</p>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  )
}


