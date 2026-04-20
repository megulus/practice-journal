'use client'

import { useEffect, useState, useCallback } from 'react'
import { useApi } from '@/lib/useApi'
import type {
  TodayResponse,
  TodayInstrumentDue,
  TodayInstrumentNotDue,
  PreSessionResponse,
  SuggestionItem,
  InstrumentBrief,
} from '@/lib/types'

export default function TodayPage() {
  const api = useApi()
  const [data, setData] = useState<TodayResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedInstrumentId, setSelectedInstrumentId] = useState<
    number | null
  >(null)
  const [suggestion, setSuggestion] = useState<SuggestionItem | null>(null)
  const [suggestionDismissed, setSuggestionDismissed] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const today = await api.getToday()
      setData(today)

      // Default to the first due instrument
      const allInstruments = [
        ...today.instruments_due,
        ...today.instruments_not_due,
      ]
      if (allInstruments.length > 0 && !selectedInstrumentId) {
        const first =
          today.instruments_due[0]?.instrument ??
          today.instruments_not_due[0]?.instrument
        if (first) setSelectedInstrumentId(first.id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [api, selectedInstrumentId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Fetch pre-session suggestion when instrument changes
  useEffect(() => {
    if (!selectedInstrumentId) return
    setSuggestionDismissed(false)
    api
      .getPreSessionSuggestion(selectedInstrumentId)
      .then((res: PreSessionResponse) => setSuggestion(res.suggestion))
      .catch(() => setSuggestion(null))
  }, [api, selectedInstrumentId])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen px-6">
        <div className="text-center">
          <p className="text-red-600 mb-2">{error}</p>
          <button
            onClick={fetchData}
            className="text-primary-600 underline text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!data) return null

  // Combine instruments for the toggle
  const allInstruments: InstrumentBrief[] = [
    ...data.instruments_due.map((d) => d.instrument),
    ...data.instruments_not_due.map((d) => d.instrument),
  ]
  const showToggle = allInstruments.length > 1

  // Find the selected instrument's data
  const selectedDue = data.instruments_due.find(
    (d) => d.instrument.id === selectedInstrumentId
  )
  const selectedNotDue = data.instruments_not_due.find(
    (d) => d.instrument.id === selectedInstrumentId
  )

  return (
    <main className="min-h-screen bg-gray-50 px-4 pt-6">
      <div className="max-w-lg mx-auto">
        {/* Instrument toggle */}
        {showToggle && (
          <InstrumentToggle
            instruments={allInstruments}
            selectedId={selectedInstrumentId}
            dueIds={new Set(data.instruments_due.map((d) => d.instrument.id))}
            onSelect={setSelectedInstrumentId}
          />
        )}

        {/* Pre-session suggestion */}
        {suggestion && !suggestionDismissed && (
          <SuggestionCard
            suggestion={suggestion}
            instrumentId={selectedInstrumentId}
            onDismiss={() => setSuggestionDismissed(true)}
          />
        )}

        {/* Active session resume banner */}
        {data.active_session && (
          <div className="mb-4 p-4 bg-primary-50 border border-primary-200 rounded-xl">
            <p className="text-sm text-primary-800 font-medium mb-2">
              You have a session in progress
            </p>
            <p className="text-xs text-primary-600 mb-3">
              {data.active_session.instrument_name}
              {data.active_session.session_name &&
                ` — ${data.active_session.session_name}`}
            </p>
            <a
              href={`/session/${data.active_session.practice_log_id}`}
              className="block w-full text-center py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
            >
              Resume session
            </a>
          </div>
        )}

        {/* Plan card — instrument is due */}
        {selectedDue && <DueInstrumentCard entry={selectedDue} />}

        {/* Instrument not due */}
        {selectedNotDue && !selectedDue && (
          <NotDueCard entry={selectedNotDue} />
        )}

        {/* No instruments at all */}
        {allInstruments.length === 0 && <EmptyState />}
      </div>
    </main>
  )
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function InstrumentToggle({
  instruments,
  selectedId,
  dueIds,
  onSelect,
}: {
  instruments: InstrumentBrief[]
  selectedId: number | null
  dueIds: Set<number>
  onSelect: (id: number) => void
}) {
  return (
    <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
      {instruments.map((inst) => {
        const isSelected = inst.id === selectedId
        const isDue = dueIds.has(inst.id)
        return (
          <button
            key={inst.id}
            onClick={() => onSelect(inst.id)}
            className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
              isSelected
                ? 'bg-primary-600 text-white font-medium'
                : isDue
                  ? 'bg-white text-gray-700 border border-gray-300 hover:border-primary-400'
                  : 'bg-white text-gray-400 border border-gray-200'
            }`}
          >
            {inst.name}
          </button>
        )
      })}
    </div>
  )
}

function SuggestionCard({
  suggestion,
  instrumentId,
  onDismiss,
}: {
  suggestion: SuggestionItem
  instrumentId: number | null
  onDismiss: () => void
}) {
  const api = useApi()

  const handleDismiss = async () => {
    if (instrumentId) {
      try {
        await api.dismissSuggestion({
          rule_id: suggestion.rule_id,
          tier: suggestion.tier,
          instrument_id: instrumentId,
        })
      } catch {
        // Dismiss locally even if the API call fails
      }
    }
    onDismiss()
  }

  return (
    <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
      <div className="flex justify-between items-start">
        <p className="text-sm text-amber-900 leading-relaxed flex-1 pr-2">
          {suggestion.text}
        </p>
        <button
          onClick={handleDismiss}
          className="text-amber-400 hover:text-amber-600 p-1 flex-shrink-0"
          aria-label="Dismiss suggestion"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

function DueInstrumentCard({ entry }: { entry: TodayInstrumentDue }) {
  const { current_session, repeat_session } = entry

  return (
    <div>
      {/* Header */}
      <h1 className="text-lg font-semibold text-gray-900 mb-4">
        Today&apos;s practice
      </h1>

      {current_session ? (
        <>
          {/* Plan card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-4">
            {/* Day focus — headline */}
            {current_session.focus_description && (
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                {current_session.focus_description}
              </h2>
            )}

            {/* Plan source */}
            <p className="text-sm text-gray-500 mb-3">
              {current_session.template_name} —{' '}
              {current_session.rotation_position}
              {current_session.estimated_duration_minutes &&
                ` · ~${current_session.estimated_duration_minutes} min`}
            </p>

            {/* Section pills */}
            {current_session.section_types.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-1">
                {current_session.section_types.map((type) => (
                  <span
                    key={type}
                    className="px-2.5 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs"
                  >
                    {formatSectionType(type)}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Start session button */}
          <a
            href={`/session/start?instrument=${entry.instrument.id}&template=${current_session.template_id}&session=${current_session.session_id}`}
            className="block w-full text-center py-3 bg-primary-600 text-white rounded-xl font-medium text-base hover:bg-primary-700 transition-colors shadow-sm"
          >
            Start session
          </a>

          {/* Repeat last session shortcut */}
          {repeat_session && (
            <a
              href={`/session/start?instrument=${entry.instrument.id}&template=${current_session.template_id}&session=${repeat_session.session_id}`}
              className="block w-full text-center py-2.5 mt-2 text-primary-600 text-sm hover:text-primary-700 transition-colors"
            >
              Repeat last session ({repeat_session.session_name})
            </a>
          )}
        </>
      ) : (
        /* No active template — just show freeform option */
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-4 text-center">
          <p className="text-gray-600 mb-1">No active plan for this instrument.</p>
          <p className="text-sm text-gray-400">
            Practice off-plan or create a plan in the Plans tab.
          </p>
        </div>
      )}

      {/* Practice off-plan */}
      <a
        href={`/session/start?instrument=${entry.instrument.id}`}
        className="block w-full text-center py-2 mt-2 text-gray-500 text-sm hover:text-gray-700 transition-colors"
      >
        Practice off-plan
      </a>
    </div>
  )
}

function NotDueCard({ entry }: { entry: TodayInstrumentNotDue }) {
  return (
    <div className="text-center py-8">
      <p className="text-gray-500 mb-1">
        {entry.instrument.name} is not due today.
      </p>
      {entry.next_due_description && (
        <p className="text-sm text-gray-400 mb-4">
          {entry.next_due_description}
        </p>
      )}
      <a
        href={`/session/start?instrument=${entry.instrument.id}`}
        className="text-primary-600 text-sm hover:text-primary-700 underline"
      >
        Practice anyway
      </a>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="text-center py-16">
      <h1 className="text-xl font-semibold text-gray-900 mb-2">
        Welcome to Kantelo
      </h1>
      <p className="text-gray-500 mb-6">
        Add an instrument in the Profile tab to get started.
      </p>
      <a
        href="/profile"
        className="inline-block px-6 py-2.5 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors"
      >
        Go to Profile
      </a>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatSectionType(type: string): string {
  const labels: Record<string, string> = {
    warmup: 'Warm-up',
    scales: 'Scales',
    repertoire: 'Repertoire',
    sight_reading: 'Sight-reading',
    ear_training: 'Ear training',
    cooldown: 'Cool-down',
    other: 'Other',
  }
  return labels[type] ?? type.replace(/_/g, ' ')
}
