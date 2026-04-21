'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useApi } from '@/lib/useApi'
import { Suspense } from 'react'

function StartSessionInner() {
  const api = useApi()
  const router = useRouter()
  const params = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const instrumentId = params.get('instrument')
    if (!instrumentId) {
      setError('Missing instrument parameter')
      return
    }

    const templateId = params.get('template')
    const sessionId = params.get('session')

    const startSession = async () => {
      try {
        const log = await api.startPractice({
          instrument_id: Number(instrumentId),
          template_id: templateId ? Number(templateId) : undefined,
          template_session_id: sessionId ? Number(sessionId) : undefined,
        })
        router.replace(`/session/${log.id}`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to start session')
      }
    }

    startSession()
  }, [api, params, router])

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] px-6">
        <div className="text-center">
          <p className="text-red-600 mb-3">{error}</p>
          <button
            onClick={() => router.push('/today')}
            className="text-primary-600 underline text-sm"
          >
            Back to Today
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
      <div className="text-gray-500">Starting session...</div>
    </div>
  )
}

export default function StartSessionPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="text-gray-500">Loading...</div>
      </div>
    }>
      <StartSessionInner />
    </Suspense>
  )
}
