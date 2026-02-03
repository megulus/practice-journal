'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useApi } from '@/lib/useApi'
import { evaluateRules } from '@/lib/progressionRules'
import type { UserInstrument, PracticeTemplate, PracticeDay, BlockType, Suggestion } from '@/lib/types'
import DaySelector from '@/components/DaySelector'
import PracticeBlock from '@/components/PracticeBlock'

export default function PracticePlanPage() {
  const params = useParams()
  const router = useRouter()
  const api = useApi()
  const instrumentName = params.instrument as string
  const [userInstrument, setUserInstrument] = useState<UserInstrument | null>(null)
  const [template, setTemplate] = useState<PracticeTemplate | null>(null)
  const [selectedDay, setSelectedDay] = useState(1)
  const [currentDayData, setCurrentDayData] = useState<PracticeDay | null>(null)
  const [blockTypes, setBlockTypes] = useState<BlockType[]>([])
  const [suggestionsCount, setSuggestionsCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getBlockTypes().then(setBlockTypes).catch(() => {})

    api.getUserInstruments()
      .then(async (userInstruments) => {
        const ui = userInstruments.find(
          (ui) => ui.instrument.name.toLowerCase() === instrumentName.toLowerCase()
        )
        if (ui) {
          setUserInstrument(ui)
          const allTemplates = await api.getTemplates(ui.id)
          const tmpl = allTemplates.find((t) => t.is_active)
          if (tmpl) {
            // Fetch suggestions count
            try {
              const progressData = await api.getSuggestionsProgress(ui.instrument.id)
              const dismissedKeys: Set<string> = typeof window !== 'undefined'
                ? new Set(JSON.parse(localStorage.getItem(`dismissed_suggestions_${instrumentName}`) || '[]') as string[])
                : new Set<string>()
              const suggestions = evaluateRules(
                progressData.exercises,
                progressData.progress,
                dismissedKeys
              )
              setSuggestionsCount(suggestions.length)
            } catch (err) {
              console.error('Failed to load suggestions:', err)
            }
            return api.getTemplate(tmpl.id)
          }
        }
        return null
      })
      .then((tmpl) => {
        if (tmpl) {
          setTemplate(tmpl)
          if (tmpl.practice_days && tmpl.practice_days.length > 0) {
            const day1 = tmpl.practice_days.find((d) => d.day_number === 1)
            if (day1) {
              setCurrentDayData(day1)
            }
          }
        }
        setLoading(false)
      })
      .catch((err) => {
        console.error(err)
        setLoading(false)
      })
  }, [instrumentName, api])

  useEffect(() => {
    if (template?.practice_days) {
      const dayData = template.practice_days.find((d: PracticeDay) => d.day_number === selectedDay)
      if (dayData) {
        setCurrentDayData(dayData)
      }
    }
  }, [selectedDay, template])

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-primary-100 to-secondary-100 p-8">
        <div className="max-w-6xl mx-auto">
          <p className="text-center text-gray-600">Loading practice plan...</p>
        </div>
      </main>
    )
  }

  if (!template) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-primary-100 to-secondary-100 p-8">
        <div className="max-w-6xl mx-auto">
          <p className="text-center text-red-600">No active template found</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-primary-100 to-secondary-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-br from-primary-500 to-primary-700 text-white p-8 text-center relative">
            <h1 className="text-4xl font-bold mb-2">Practice Plan</h1>
            <p className="text-primary-100 text-lg">{template.name}</p>
            <div className="mt-3 flex items-center justify-center gap-4">
              <button
                onClick={() =>
                  router.push(`/${instrumentName}/template/edit?templateId=${template.id}`)
                }
                className="text-sm text-primary-200 hover:text-white underline underline-offset-2"
              >
                Edit Template
              </button>
              {suggestionsCount > 0 && (
                <Link
                  href={`/${instrumentName}/suggestions`}
                  className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full text-sm transition-colors"
                >
                  <span className="bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-0.5 rounded-full">
                    {suggestionsCount}
                  </span>
                  <span>Suggestions</span>
                </Link>
              )}
            </div>
          </div>

          <div className="p-8">
            <div className="bg-blue-50 border-l-4 border-blue-500 p-5 rounded-lg mb-8">
              <h3 className="text-blue-900 font-semibold mb-2">
                Your {template.days_count}-Day Rotation
              </h3>
              <p className="text-blue-800">
                {template.description ||
                  'This rotation ensures systematic coverage of all technical areas.'}
              </p>
            </div>

            <DaySelector
              daysCount={template.days_count}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
            />

            {currentDayData && <PracticeBlock day={currentDayData} blockTypes={blockTypes} />}
          </div>
        </div>
      </div>
    </main>
  )
}


