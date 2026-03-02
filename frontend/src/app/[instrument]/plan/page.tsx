'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useApi } from '@/lib/useApi'
import { evaluateRules } from '@/lib/progressionRules'
import type { UserInstrument, PracticeTemplate, PracticeDay, BlockType, Suggestion, PracticeLog } from '@/lib/types'
import DaySelector from '@/components/DaySelector'
import PracticeBlock from '@/components/PracticeBlock'

export default function PracticePlanPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const api = useApi()
  const instrumentName = params.instrument as string
  const loggedParam = searchParams.get('logged')
  const [userInstrument, setUserInstrument] = useState<UserInstrument | null>(null)
  const [template, setTemplate] = useState<PracticeTemplate | null>(null)
  const [selectedDay, setSelectedDay] = useState(1)
  const [currentDayData, setCurrentDayData] = useState<PracticeDay | null>(null)
  const [blockTypes, setBlockTypes] = useState<BlockType[]>([])
  const [suggestionsCount, setSuggestionsCount] = useState(0)
  const [todayLogs, setTodayLogs] = useState<PracticeLog[]>([])
  const [showLoggedToast, setShowLoggedToast] = useState(false)
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

  // Fetch today's logs on initial load
  useEffect(() => {
    if (!template) return
    const today = new Date().toISOString().split('T')[0]
    api.getLogs(template.id).then((logs) => {
      setTodayLogs(logs.filter((log) => log.practice_date === today))
    }).catch((err) => {
      console.error('Failed to fetch logs:', err)
    })
  }, [template, api])

  // Handle return from single-block log: show toast, re-fetch logs, clean URL
  const loggedParamHandled = useRef<string | null>(null)
  useEffect(() => {
    if (!loggedParam || loggedParam === loggedParamHandled.current) return
    loggedParamHandled.current = loggedParam

    setShowLoggedToast(true)
    setTimeout(() => setShowLoggedToast(false), 3000)

    if (template) {
      const today = new Date().toISOString().split('T')[0]
      api.getLogs(template.id).then((logs) => {
        setTodayLogs(logs.filter((log) => log.practice_date === today))
      }).catch(console.error)
    }

    router.replace(`/${instrumentName}/plan`, { scroll: false })
  }, [loggedParam, template, api, router, instrumentName])

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
      {showLoggedToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Practice logged!
        </div>
      )}
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

            {currentDayData && (
              <>
                <PracticeBlock
                  day={currentDayData}
                  blockTypes={blockTypes}
                  onLogBlock={(blockId) =>
                    router.push(
                      `/${instrumentName}/log?day=${selectedDay}&blockId=${blockId}`
                    )
                  }
                  loggedBlockIds={(() => {
                    const ids = new Set<number>()
                    for (const log of todayLogs) {
                      for (const detail of log.log_details) {
                        for (const block of currentDayData.exercise_blocks) {
                          // Match by exercise_id
                          if (detail.exercise_id && block.exercises.some((ex) => ex.id === detail.exercise_id)) {
                            ids.add(block.id)
                          }
                          // Match by section_type for blocks without exercises
                          if (!detail.exercise_id && detail.section_type === block.block_type) {
                            ids.add(block.id)
                          }
                        }
                      }
                    }
                    return ids
                  })()}
                />
                <div className="mt-6 text-center">
                  <button
                    onClick={() =>
                      router.push(`/${instrumentName}/log?day=${selectedDay}`)
                    }
                    className="px-6 py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-colors"
                  >
                    Log full session
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}


