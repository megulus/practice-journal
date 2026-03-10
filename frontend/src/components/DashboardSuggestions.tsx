'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import SuggestionCard from './SuggestionCard'
import type { Suggestion, InteractionType } from '@/lib/types'

interface DashboardSuggestionsProps {
  instrumentId: number
  instrumentName: string
  api: ReturnType<typeof import('@/lib/useApi').useApi>
}

export default function DashboardSuggestions({
  instrumentId,
  instrumentName,
  api,
}: DashboardSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(`dismissed_suggestions_${instrumentName}`)
      return stored ? new Set(JSON.parse(stored)) : new Set()
    }
    return new Set()
  })
  const shownRef = useRef<Set<string>>(new Set())
  const fetchedRef = useRef(false)

  const trackInteraction = useCallback(
    (suggestion: Suggestion, type: InteractionType) => {
      // Extract rule ID from suggestion key (e.g., "session_consistency_all" -> "consistency")
      const ruleId = suggestion.type
      api.recordInteraction({
        suggestion_rule_id: ruleId,
        suggestion_text: suggestion.message,
        interaction_type: type,
        instrument_id: suggestion.instrument_id ?? undefined,
      }).catch((err: unknown) => {
        console.error('Failed to record interaction:', err)
      })
    },
    [api]
  )

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true

    const loadSuggestions = async () => {
      try {
        // Check settings first
        const settings = await api.getSettings()
        if (!settings.suggestions_enabled) {
          setLoading(false)
          return
        }

        const sessionData = await api.getSessionSuggestions(instrumentId)
        const filtered = sessionData.filter((s) => !dismissedKeys.has(s.key))
        setSuggestions(filtered.slice(0, 3))
      } catch {
        // Fail silently — suggestions are not critical
      } finally {
        setLoading(false)
      }
    }

    loadSuggestions()
  }, [instrumentId, api, dismissedKeys])

  // Track "shown" interactions once suggestions are loaded
  useEffect(() => {
    for (const suggestion of suggestions) {
      if (!shownRef.current.has(suggestion.key)) {
        shownRef.current.add(suggestion.key)
        trackInteraction(suggestion, 'shown')
      }
    }
  }, [suggestions, trackInteraction])

  const saveDismissedKeys = (keys: Set<string>) => {
    setDismissedKeys(keys)
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        `dismissed_suggestions_${instrumentName}`,
        JSON.stringify([...keys])
      )
    }
  }

  const handleDismiss = (suggestion: Suggestion) => {
    trackInteraction(suggestion, 'dismissed')
    api.dismissSuggestion(suggestion.key).catch((err: unknown) => {
      console.error('Failed to dismiss suggestion:', err)
    })
    setSuggestions((prev) => prev.filter((s) => s.key !== suggestion.key))
    saveDismissedKeys(new Set([...dismissedKeys, suggestion.key]))
  }

  const handleActedOn = (suggestion: Suggestion) => {
    trackInteraction(suggestion, 'acted_on')
  }

  // Don't render anything while loading or if empty
  if (loading || suggestions.length === 0) return null

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Suggestions
        </h3>
        <Link
          href={`/${instrumentName}/suggestions`}
          className="text-sm text-primary-600 hover:text-primary-800 font-medium"
        >
          View all
        </Link>
      </div>
      <div className="space-y-3">
        {suggestions.map((suggestion) => (
          <SuggestionCard
            key={suggestion.key}
            suggestion={suggestion}
            onDismiss={() => handleDismiss(suggestion)}
            onAccept={
              suggestion.action
                ? () => handleActedOn(suggestion)
                : undefined
            }
            showExerciseName={false}
            compact
          />
        ))}
      </div>
    </div>
  )
}
