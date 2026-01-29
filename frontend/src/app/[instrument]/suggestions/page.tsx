'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useApi } from '@/lib/useApi'
import SuggestionCard from '@/components/SuggestionCard'
import { evaluateRules } from '@/lib/progressionRules'
import type { Instrument, Suggestion } from '@/lib/types'

export default function SuggestionsPage() {
  const params = useParams()
  const router = useRouter()
  const api = useApi()
  const instrumentName = params.instrument as string

  const [instrument, setInstrument] = useState<Instrument | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(() => {
    // Load dismissed keys from localStorage
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(`dismissed_suggestions_${instrumentName}`)
      return stored ? new Set(JSON.parse(stored)) : new Set()
    }
    return new Set()
  })

  useEffect(() => {
    const loadSuggestions = async () => {
      try {
        const instruments = await api.getInstruments()
        const inst = instruments.find(
          (i) => i.name.toLowerCase() === instrumentName.toLowerCase()
        )

        if (!inst) {
          router.push('/')
          return
        }

        setInstrument(inst)

        const progressData = await api.getSuggestionsProgress(inst.id)
        const newSuggestions = evaluateRules(
          progressData.exercises,
          progressData.progress,
          dismissedKeys
        )
        setSuggestions(newSuggestions)
      } catch (err) {
        console.error('Failed to load suggestions:', err)
      } finally {
        setLoading(false)
      }
    }

    loadSuggestions()
  }, [instrumentName, api, router, dismissedKeys])

  const saveDismissedKeys = (keys: Set<string>) => {
    setDismissedKeys(keys)
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        `dismissed_suggestions_${instrumentName}`,
        JSON.stringify([...keys])
      )
    }
  }

  const handleAcceptSuggestion = async (suggestion: Suggestion) => {
    if (!suggestion.action) return
    try {
      await api.acceptSuggestion(suggestion.key, suggestion.action)
      setSuggestions(suggestions.filter((s) => s.key !== suggestion.key))
      const newKeys = new Set([...dismissedKeys, suggestion.key])
      saveDismissedKeys(newKeys)
    } catch (err) {
      console.error('Failed to accept suggestion:', err)
    }
  }

  const handleDismissSuggestion = async (suggestion: Suggestion) => {
    try {
      await api.dismissSuggestion(suggestion.key)
      setSuggestions(suggestions.filter((s) => s.key !== suggestion.key))
      const newKeys = new Set([...dismissedKeys, suggestion.key])
      saveDismissedKeys(newKeys)
    } catch (err) {
      console.error('Failed to dismiss suggestion:', err)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-primary-100 to-secondary-100 p-8">
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-gray-600">Loading suggestions...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-primary-100 to-secondary-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-br from-purple-500 to-purple-700 text-white p-8 text-center">
            <h1 className="text-4xl font-bold mb-2">Suggestions</h1>
            <p className="text-purple-100 text-lg">
              {instrument?.name} practice recommendations
            </p>
          </div>

          <div className="p-8">
            {suggestions.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">&#127942;</div>
                <h2 className="text-xl font-semibold text-gray-700 mb-2">
                  No suggestions right now
                </h2>
                <p className="text-gray-500 mb-6">
                  Keep practicing! Suggestions appear based on your progress and
                  practice history.
                </p>
                <Link
                  href={`/${instrumentName}/log`}
                  className="inline-block bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
                >
                  Log a practice session
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {suggestions.map((suggestion) => (
                  <SuggestionCard
                    key={suggestion.key}
                    suggestion={suggestion}
                    onAccept={
                      suggestion.action
                        ? () => handleAcceptSuggestion(suggestion)
                        : undefined
                    }
                    onDismiss={() => handleDismissSuggestion(suggestion)}
                    compact
                  />
                ))}
              </div>
            )}

            <div className="mt-8 pt-8 border-t border-gray-200">
              <div className="flex gap-4 justify-center">
                <Link
                  href={`/${instrumentName}/plan`}
                  className="text-primary-600 hover:text-primary-800 font-medium"
                >
                  View practice plan
                </Link>
                <span className="text-gray-300">|</span>
                <Link
                  href={`/${instrumentName}/log`}
                  className="text-primary-600 hover:text-primary-800 font-medium"
                >
                  Log practice
                </Link>
                <span className="text-gray-300">|</span>
                <Link
                  href={`/${instrumentName}/history`}
                  className="text-primary-600 hover:text-primary-800 font-medium"
                >
                  View history
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
