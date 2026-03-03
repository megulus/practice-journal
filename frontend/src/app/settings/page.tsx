'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useApi } from '@/lib/useApi'
import { useUser } from '@clerk/nextjs'
import type { UserSettings } from '@/lib/types'

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const api = useApi()
  const { isLoaded, isSignedIn } = useUser()
  const hasFetched = useRef(false)

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) {
      router.push('/sign-in')
      return
    }
    if (hasFetched.current) return
    hasFetched.current = true

    const fetchSettings = async () => {
      try {
        const data = await api.getSettings()
        setSettings(data)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchSettings()
  }, [isLoaded, isSignedIn, router, api])

  const handleToggle = async (field: keyof UserSettings, value: boolean) => {
    if (!settings) return
    setSaving(true)

    // Optimistic update
    const prev = settings
    setSettings({ ...settings, [field]: value })

    try {
      const updated = await api.updateSettings({ [field]: value })
      setSettings(updated)
    } catch (err: any) {
      // Revert on error
      setSettings(prev)
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!isLoaded || loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-primary-100 to-secondary-100 p-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold mb-8 text-primary-700">Settings</h1>
          <div className="bg-white rounded-xl shadow-xl p-8">
            <p className="text-center text-gray-500">Loading...</p>
          </div>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-primary-100 to-secondary-100 p-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold mb-8 text-primary-700">Settings</h1>
          <div className="bg-red-50 rounded-xl shadow-xl p-8">
            <p className="text-center text-red-600">Error: {error}</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-primary-100 to-secondary-100 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-primary-700">Settings</h1>

        <div className="bg-white rounded-xl shadow-xl p-6 space-y-6">
          {/* Practice Suggestions */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Practice suggestions</h2>
              <p className="text-sm text-gray-500">
                Show personalized practice suggestions based on your progress
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings?.suggestions_enabled}
              disabled={saving}
              onClick={() => handleToggle('suggestions_enabled', !settings?.suggestions_enabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 ${
                settings?.suggestions_enabled ? 'bg-primary-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  settings?.suggestions_enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
