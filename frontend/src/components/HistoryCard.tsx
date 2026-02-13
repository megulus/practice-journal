'use client'

import { useState } from 'react'
import type { PracticeLog } from '@/lib/types'
import { formatTempo } from '@/lib/metronome'

interface HistoryCardProps {
  log: PracticeLog
  dayTitle?: string
}

export default function HistoryCard({ log, dayTitle }: HistoryCardProps) {
  const [expanded, setExpanded] = useState(false)
  const date = new Date(log.practice_date)
  const formattedDate = date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const hasDetails =
    log.notes || (log.log_details && log.log_details.some((d) => d.content))

  return (
    <div
      className={`bg-white rounded-xl p-6 shadow-md mb-4 ${hasDetails ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''}`}
      onClick={() => hasDetails && setExpanded(!expanded)}
    >
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-primary-600 text-lg">{formattedDate}</span>
          {dayTitle && (
            <span className="text-gray-500 text-sm">— {dayTitle}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-primary-500 text-white px-4 py-2 rounded-full text-sm">
            {log.duration_minutes} min
          </span>
          {hasDetails && (
            <span className={`text-gray-400 text-sm inline-block transition-transform ${expanded ? 'rotate-90' : ''}`}>
              &#x203A;
            </span>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t-2 border-gray-100">
          {log.notes && (
            <div className="mb-3">
              <p className="font-semibold text-gray-700">Notes:</p>
              <p className="text-gray-600">{log.notes}</p>
            </div>
          )}
          {log.log_details && log.log_details.length > 0 && (
            <div className="space-y-2">
              {log.log_details.map((detail) => (
                detail.content && (
                  <div key={detail.id}>
                    <p className="font-semibold text-gray-700 capitalize">
                      {detail.section_type.replace(/-/g, ' ')}
                      {detail.duration_minutes && (
                        <span className="ml-1 font-normal text-sm text-gray-500">
                          ({detail.duration_minutes} min)
                        </span>
                      )}
                      :
                    </p>
                    <p className="text-gray-600">{detail.content}</p>
                    {(detail.tempo_practiced || detail.key_practiced || detail.time_signature) && (
                      <p className="text-sm text-gray-500 mt-0.5">
                        {[
                          detail.tempo_practiced && formatTempo(detail.tempo_practiced),
                          detail.key_practiced,
                          detail.time_signature,
                        ]
                          .filter(Boolean)
                          .join(' \u00B7 ')}
                      </p>
                    )}
                  </div>
                )
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
