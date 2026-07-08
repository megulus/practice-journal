'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { AlertCircle, X } from 'lucide-react'
import { useApi } from '@/lib/useApi'
import { Button, Card, Pill, RotationDots } from '@/components/ui'
import { cx } from '@/lib/cx'
import { getSectionColor } from '@/lib/section-colors'
import type {
  TodayResponse,
  TodayInstrumentDue,
  TodayInstrumentNotDue,
  PreSessionResponse,
  SuggestionItem,
  InstrumentBrief,
  SectionType,
} from '@/lib/types'

// Shared CTA styles (token-driven). A `ButtonLink` primitive could be extracted
// if this recurs across the other screen retones (#207–210).
const PRIMARY_LINK =
  'block w-full rounded-lg bg-primary px-4 py-3 text-center text-sm font-medium ' +
  'text-text-on-primary-action transition-colors hover:bg-primary-hover'
const SECONDARY_LINK =
  'block w-full py-2 text-center text-sm text-text-link transition-colors hover:text-text-primary'

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

      // Default to the first due instrument (only if none selected yet)
      const allInstruments = [
        ...today.instruments_due,
        ...today.instruments_not_due,
      ]
      if (allInstruments.length > 0) {
        const first =
          today.instruments_due[0]?.instrument ??
          today.instruments_not_due[0]?.instrument
        if (first) {
          setSelectedInstrumentId((prev) => prev ?? first.id)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [api])

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
      <div className="flex justify-center py-16 text-text-secondary">
        Loading…
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-16 text-center">
        <p className="mb-3 text-danger-text">{error}</p>
        <Button variant="ghost" size="sm" onClick={fetchData}>
          Retry
        </Button>
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
    <div className="space-y-4">
      {/* Instrument toggle */}
      {showToggle && (
        <InstrumentToggle
          instruments={allInstruments}
          selectedId={selectedInstrumentId}
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
        <Card>
          <p className="text-sm font-medium text-text-primary">
            You have a session in progress
          </p>
          <p className="mb-3 mt-1 text-xs text-text-secondary">
            {data.active_session.instrument_name}
            {data.active_session.session_name &&
              ` — ${data.active_session.session_name}`}
          </p>
          <Link
            href={`/session/${data.active_session.practice_log_id}`}
            className={PRIMARY_LINK}
          >
            Resume session
          </Link>
        </Card>
      )}

      {/* Plan card — instrument is due */}
      {selectedDue && <DueInstrumentCard entry={selectedDue} />}

      {/* Instrument not due */}
      {selectedNotDue && !selectedDue && <NotDueCard entry={selectedNotDue} />}

      {/* No instruments at all */}
      {allInstruments.length === 0 && <EmptyState />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function InstrumentToggle({
  instruments,
  selectedId,
  onSelect,
}: {
  instruments: InstrumentBrief[]
  selectedId: number | null
  onSelect: (id: number) => void
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {instruments.map((inst) => (
        <Pill
          key={inst.id}
          variant="instrument"
          active={inst.id === selectedId}
          onClick={() => onSelect(inst.id)}
          className="whitespace-nowrap"
        >
          {inst.name}
        </Pill>
      ))}
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
    <Card variant="suggestion" icon={<AlertCircle size={12} strokeWidth={2.5} />}>
      <div className="flex items-start justify-between gap-md">
        <p className="flex-1 text-sm leading-relaxed text-amber-text">
          {suggestion.text}
        </p>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss suggestion"
          className="flex-shrink-0 p-0.5 text-amber-text-muted"
        >
          <X size={14} />
        </button>
      </div>
    </Card>
  )
}

function DueInstrumentCard({ entry }: { entry: TodayInstrumentDue }) {
  const { current_session, repeat_session, all_sessions } = entry

  const total = all_sessions.length
  const currentIndex = current_session
    ? all_sessions.findIndex((s) => s.session_id === current_session.session_id)
    : -1

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <h1 className="text-lg font-semibold text-text-primary">
          Today&apos;s practice
        </h1>
        {current_session && total > 1 && (
          <RotationDots total={total} current={currentIndex + 1} />
        )}
      </div>

      {current_session ? (
        <>
          {/* Plan card */}
          <Card className="mb-4">
            {/* Day focus — headline */}
            {current_session.focus_description && (
              <h2 className="mb-2 text-xl font-semibold text-text-primary">
                {current_session.focus_description}
              </h2>
            )}

            {/* Plan source */}
            <p className="mb-3 text-sm text-text-secondary">
              {current_session.template_name} —{' '}
              {current_session.rotation_position}
              {current_session.estimated_duration_minutes &&
                ` · ~${current_session.estimated_duration_minutes} min`}
            </p>

            {/* Section pills */}
            {current_session.section_types.length > 0 && (
              <SectionPills types={current_session.section_types} />
            )}
          </Card>

          {/* Start session button */}
          <Link
            href={`/session/start?instrument=${entry.instrument.id}&template=${current_session.template_id}&session=${current_session.session_id}`}
            className={PRIMARY_LINK}
          >
            Start session
          </Link>

          {/* Repeat last session shortcut */}
          {repeat_session && (
            <Link
              href={`/session/start?instrument=${entry.instrument.id}&template=${current_session.template_id}&session=${repeat_session.session_id}`}
              className={SECONDARY_LINK}
            >
              Repeat last session ({repeat_session.session_name})
            </Link>
          )}
        </>
      ) : (
        /* No active template — just show freeform option */
        <Card className="text-center">
          <p className="text-text-secondary">
            No active plan for this instrument.
          </p>
          <p className="mt-1 text-sm text-text-tertiary">
            Practice off-plan or create a plan in the Plans tab.
          </p>
        </Card>
      )}

      {/* Practice off-plan */}
      <Link
        href={`/session/start?instrument=${entry.instrument.id}`}
        className={cx(SECONDARY_LINK, 'text-text-tertiary')}
      >
        Practice off-plan
      </Link>
    </div>
  )
}

function SectionPills({ types }: { types: SectionType[] }) {
  let nonPinnedIndex = 0
  return (
    <div className="flex flex-wrap gap-2">
      {types.map((type) => {
        const isPinned = type === 'warmup' || type === 'cooldown'
        const color = getSectionColor(type, isPinned ? 0 : nonPinnedIndex)
        if (!isPinned) nonPinnedIndex++
        return (
          <Pill key={type} variant="sectionType" color={color}>
            {formatSectionType(type)}
          </Pill>
        )
      })}
    </div>
  )
}

function NotDueCard({ entry }: { entry: TodayInstrumentNotDue }) {
  return (
    <div className="py-8 text-center">
      <p className="mb-1 text-text-secondary">
        {entry.instrument.name} is not due today.
      </p>
      {entry.next_due_description && (
        <p className="mb-4 text-sm text-text-tertiary">
          {entry.next_due_description}
        </p>
      )}
      <Link
        href={`/session/start?instrument=${entry.instrument.id}`}
        className="text-sm text-text-link hover:text-text-primary"
      >
        Practice anyway
      </Link>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="py-16 text-center">
      <h1 className="mb-2 text-xl font-semibold text-text-primary">
        Welcome to Kantelo
      </h1>
      <p className="mb-6 text-text-secondary">
        Add an instrument in the Profile tab to get started.
      </p>
      <Link
        href="/profile"
        className="inline-block rounded-lg bg-primary px-6 py-2.5 font-medium text-text-on-primary-action transition-colors hover:bg-primary-hover"
      >
        Go to Profile
      </Link>
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
