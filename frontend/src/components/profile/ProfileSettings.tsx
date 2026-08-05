'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useApi } from '@/lib/useApi'
import { Pill, Radio } from '@/components/ui'
import { useTheme } from '@/hooks/useTheme'
import type { ThemePreference } from '@/components/ThemeProvider'
import type {
  SuggestionsPreference,
  UserSettings,
  UserSettingsUpdate,
  WeekStart,
} from '@/lib/types'
import { SectionHeading } from './SectionHeading'

const SUGGESTION_OPTIONS: {
  value: SuggestionsPreference
  label: string
  description: string
}[] = [
  {
    value: 'all',
    label: 'All suggestions',
    description: 'Before, during, and after practice',
  },
  {
    value: 'fewer',
    label: 'Fewer suggestions',
    description: 'Only in session summaries and Insights',
  },
  {
    value: 'off',
    label: 'Off',
    description: 'No coaching suggestions anywhere',
  },
]

const DURATION_OPTIONS = [15, 30, 45, 60]

const WEEK_START_OPTIONS: { value: WeekStart; label: string }[] = [
  { value: 'monday', label: 'Monday' },
  { value: 'sunday', label: 'Sunday' },
]

const THEME_OPTIONS: {
  value: ThemePreference
  label: string
  Icon: typeof Monitor
}[] = [
  { value: 'system', label: 'Match system', Icon: Monitor },
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
]

/**
 * The "Coaching suggestions" and "Preferences" sections of the Profile tab
 * (spec §5.8). Both read from the same `/api/settings` document, so they share
 * one fetch and one save path rather than each owning a copy.
 *
 * Writes are optimistic — a preference toggle should feel instant — and
 * resync to the server's value if the PATCH fails. Saves are issued one at a
 * time (see `pending` below) so rapid toggling can't leave the two out of step.
 */
export function ProfileSettings() {
  const api = useApi()
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Preference toggles are click-fast, and every PATCH response is the whole
  // settings document. Two requests in flight at once can be applied
  // server-side out of click order, and their responses can land out of order
  // too — either way the UI ends up showing a value the server doesn't hold.
  // Chaining keeps both orders honest; the optimistic paint means nobody waits.
  const pending = useRef<Promise<void>>(Promise.resolve())
  // How many saves are queued or in flight. Only the last one may paint the
  // server's document: an earlier response was composed before the later
  // click happened, so painting it would flash the older value back for a
  // round trip before the later save's response corrected it.
  const outstanding = useRef(0)

  const load = useCallback(async () => {
    try {
      setSettings(await api.getSettings())
      setError(null)
    } catch {
      setError("Couldn't load your settings. Please try again.")
    }
  }, [api])

  useEffect(() => {
    load()
  }, [load])

  const save = (patch: UserSettingsUpdate) => {
    setSettings((current) => (current ? { ...current, ...patch } : current))
    outstanding.current += 1
    pending.current = pending.current.then(async () => {
      try {
        const saved = await api.updateSettings(patch)
        if (outstanding.current === 1) setSettings(saved)
        setError(null)
      } catch {
        setError("Couldn't save that change. Please try again.")
        // Re-read instead of restoring a snapshot: the optimistic value is
        // wrong, and a snapshot taken at click time can predate an earlier
        // save that did land, silently reverting it. A later save still
        // queued will establish the truth itself, so only the last one reads.
        try {
          if (outstanding.current === 1) setSettings(await api.getSettings())
        } catch {
          // Leave the optimistic value; the banner already says it didn't save.
        }
      } finally {
        outstanding.current -= 1
      }
    })
  }

  return (
    <>
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-card-bg-inset px-3 py-2 text-sm text-danger-text"
        >
          {error}
        </p>
      )}

      <section>
        <SectionHeading>Coaching suggestions</SectionHeading>
        {settings === null ? (
          <p className="text-sm text-text-secondary">Loading…</p>
        ) : (
          <div
            role="radiogroup"
            aria-label="Coaching suggestions"
            className="space-y-3"
          >
            {SUGGESTION_OPTIONS.map(({ value, label, description }) => (
              <Radio
                key={value}
                name="suggestions-preference"
                value={value}
                label={label}
                description={description}
                checked={settings.suggestions_preference === value}
                onChange={() => save({ suggestions_preference: value })}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeading>Preferences</SectionHeading>
        <div className="space-y-5">
          <PreferenceRow
            label="Default session duration"
            hint="Used by the quick-start wizard when it builds a plan."
          >
            {settings === null ? (
              <p className="text-sm text-text-secondary">Loading…</p>
            ) : (
              <div
                role="radiogroup"
                aria-label="Default session duration"
                className="flex flex-wrap gap-sm"
              >
                {DURATION_OPTIONS.map((minutes) => {
                  const active =
                    settings.default_session_duration_minutes === minutes
                  return (
                    <Pill
                      key={minutes}
                      active={active}
                      role="radio"
                      aria-checked={active}
                      onClick={() =>
                        save({ default_session_duration_minutes: minutes })
                      }
                    >
                      {minutes} min
                    </Pill>
                  )
                })}
              </div>
            )}
          </PreferenceRow>

          <PreferenceRow
            label="Week starts on"
            hint="Sets the first column of the practice heatmap and the week boundary for comparisons."
          >
            {settings === null ? (
              <p className="text-sm text-text-secondary">Loading…</p>
            ) : (
              <div
                role="radiogroup"
                aria-label="Week starts on"
                className="flex flex-wrap gap-sm"
              >
                {WEEK_START_OPTIONS.map(({ value, label }) => {
                  const active = settings.week_starts_on === value
                  return (
                    <Pill
                      key={value}
                      active={active}
                      role="radio"
                      aria-checked={active}
                      onClick={() => save({ week_starts_on: value })}
                    >
                      {label}
                    </Pill>
                  )
                })}
              </div>
            )}
          </PreferenceRow>

          <PreferenceRow
            label="Theme"
            hint="“Match system” follows your operating system preference."
          >
            <ThemePicker />
          </PreferenceRow>
        </div>
      </section>
    </>
  )
}

function PreferenceRow({
  label,
  hint,
  children,
}: {
  label: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p
        className="text-text-primary"
        style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.5 }}
      >
        {label}
      </p>
      <p
        className="mb-md text-text-secondary"
        style={{ fontSize: 13, lineHeight: 1.5 }}
      >
        {hint}
      </p>
      {children}
    </div>
  )
}

/**
 * Theme lives in local state + localStorage today; syncing it to
 * `/api/settings` (the backend column exists) is tracked in #257.
 */
function ThemePicker() {
  const { theme, setTheme } = useTheme()

  return (
    <div role="radiogroup" aria-label="Theme" className="flex flex-wrap gap-sm">
      {THEME_OPTIONS.map(({ value, label, Icon }) => {
        const active = theme === value
        return (
          <Pill
            key={value}
            active={active}
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(value)}
          >
            <Icon size={14} strokeWidth={1.5} aria-hidden />
            {label}
          </Pill>
        )
      })}
    </div>
  )
}
