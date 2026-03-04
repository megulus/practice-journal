'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useApi } from '@/lib/useApi'
import SuggestionCard from '@/components/SuggestionCard'
import { evaluateRules } from '@/lib/progressionRules'
import type { UserInstrument, Suggestion } from '@/lib/types'

export default function SuggestionsPage() {
  const params = useParams()
  const router = useRouter()
  const api = useApi()
  const instrumentName = params.instrument as string

  const [userInstrument, setUserInstrument] = useState<UserInstrument | null>(null)
  const [sessionSuggestions, setSessionSuggestions] = useState<Suggestion[]>([])
  const [exerciseSuggestions, setExerciseSuggestions] = useState<Suggestion[]>([])
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
        const userInstruments = await api.getUserInstruments()
        const ui = userInstruments.find(
          (ui) => ui.instrument.name.toLowerCase() === instrumentName.toLowerCase()
        )

        if (!ui) {
          router.push('/me')
          return
        }

        setUserInstrument(ui)

        // Fetch both session-level and exercise-level suggestions in parallel
        const [sessionData, progressData] = await Promise.all([
          api.getSessionSuggestions(ui.instrument.id),
          api.getSuggestionsProgress(ui.instrument.id),
        ])

        // Session suggestions from backend (filter dismissed)
        const filteredSession = sessionData.filter(
          (s) => !dismissedKeys.has(s.key)
        )
        setSessionSuggestions(filteredSession)

        // Exercise suggestions from frontend rules engine
        const newExerciseSuggestions = evaluateRules(
          progressData.exercises,
          progressData.progress,
          dismissedKeys
        )
        setExerciseSuggestions(newExerciseSuggestions)
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

  const allSuggestions = [...sessionSuggestions, ...exerciseSuggestions]

  const handleAcceptSuggestion = async (suggestion: Suggestion) => {
    if (!suggestion.action) return
    try {
      await api.acceptSuggestion(suggestion.key, suggestion.action)
      setSessionSuggestions(sessionSuggestions.filter((s) => s.key !== suggestion.key))
      setExerciseSuggestions(exerciseSuggestions.filter((s) => s.key !== suggestion.key))
      const newKeys = new Set([...dismissedKeys, suggestion.key])
      saveDismissedKeys(newKeys)
    } catch (err) {
      console.error('Failed to accept suggestion:', err)
    }
  }

  const handleDismissSuggestion = async (suggestion: Suggestion) => {
    try {
      await api.dismissSuggestion(suggestion.key)
      setSessionSuggestions(sessionSuggestions.filter((s) => s.key !== suggestion.key))
      setExerciseSuggestions(exerciseSuggestions.filter((s) => s.key !== suggestion.key))
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
              {userInstrument?.instrument.name} practice recommendations
            </p>
          </div>

          <div className="p-8">
            {allSuggestions.length === 0 ? (
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
                {sessionSuggestions.length > 0 && (
                  <>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                      Practice Habits
                    </h3>
                    {sessionSuggestions.map((suggestion) => (
                      <SuggestionCard
                        key={suggestion.key}
                        suggestion={suggestion}
                        onDismiss={() => handleDismissSuggestion(suggestion)}
                        compact
                      />
                    ))}
                  </>
                )}
                {exerciseSuggestions.length > 0 && (
                  <>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mt-6">
                      Exercise Progress
                    </h3>
                    {exerciseSuggestions.map((suggestion) => (
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
                  </>
                )}
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
