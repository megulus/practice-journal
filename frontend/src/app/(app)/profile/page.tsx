'use client'

import { Monitor, Sun, Moon } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import type { ThemePreference } from '@/components/ThemeProvider'

const OPTIONS: Array<{
  value: ThemePreference
  label: string
  Icon: typeof Monitor
}> = [
  { value: 'system', label: 'Match system', Icon: Monitor },
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
]

function ThemePicker() {
  const { theme, setTheme } = useTheme()

  return (
    <div
      role="radiogroup"
      aria-label="Appearance"
      className="flex gap-sm flex-wrap"
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = theme === value
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(value)}
            className={`inline-flex items-center gap-sm rounded-md text-xs font-medium transition-colors ${
              active
                ? 'bg-pill-active-bg text-pill-active-text border border-pill-active-bg'
                : 'border border-pill-inactive-border text-pill-inactive-text hover:text-text-primary'
            }`}
            style={{ padding: '5px 14px' }}
          >
            <Icon size={14} strokeWidth={1.5} aria-hidden />
            {label}
          </button>
        )
      })}
    </div>
  )
}

export default function ProfilePage() {
  return (
    <main className="min-h-screen bg-page-bg px-4xl py-3xl">
      <h1
        className="text-text-primary font-semibold mb-2xl"
        style={{ fontSize: 24, letterSpacing: '-0.5px', lineHeight: 1.35 }}
      >
        Profile
      </h1>

      <section className="mb-2xl">
        <h2
          className="text-text-primary font-semibold mb-md"
          style={{ fontSize: 15, letterSpacing: '-0.2px', lineHeight: 1.35 }}
        >
          Appearance
        </h2>
        <ThemePicker />
        <p
          className="text-text-secondary mt-md"
          style={{ fontSize: 13, lineHeight: 1.5 }}
        >
          Choose how Kantelo looks. &ldquo;Match system&rdquo; follows your
          operating system preference.
        </p>
      </section>

      <p
        className="text-text-tertiary"
        style={{ fontSize: 11, lineHeight: 1.4 }}
      >
        More settings coming soon &mdash; tracked in #148.
      </p>
    </main>
  )
}
