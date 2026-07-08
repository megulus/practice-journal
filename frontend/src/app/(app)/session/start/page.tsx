'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useApi } from '@/lib/useApi'
import { Button } from '@/components/ui'

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
      <div className="py-16 text-center">
        <p className="mb-3 text-danger-text">{error}</p>
        <Button variant="ghost" size="sm" onClick={() => router.push('/today')}>
          Back to Today
        </Button>
      </div>
    )
  }

  return (
    <div className="flex justify-center py-16 text-text-secondary">
      Starting session…
    </div>
  )
}

export default function StartSessionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16 text-text-secondary">
          Loading…
        </div>
      }
    >
      <StartSessionInner />
    </Suspense>
  )
}
