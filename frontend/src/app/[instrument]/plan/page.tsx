'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useApi } from '@/lib/useApi'
import type { Instrument, PracticeTemplate, PracticeDay, BlockType } from '@/lib/types'
import DaySelector from '@/components/DaySelector'
import PracticeBlock from '@/components/PracticeBlock'

export default function PracticePlanPage() {
  const params = useParams()
  const router = useRouter()
  const api = useApi()
  const instrumentName = params.instrument as string
  const [template, setTemplate] = useState<PracticeTemplate | null>(null)
  const [selectedDay, setSelectedDay] = useState(1)
  const [currentDayData, setCurrentDayData] = useState<PracticeDay | null>(null)
  const [blockTypes, setBlockTypes] = useState<BlockType[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getBlockTypes().then(setBlockTypes).catch(() => {})

    Promise.all([api.getInstruments(), api.getTemplates()])
      .then(([instruments, allTemplates]) => {
        const inst = instruments.find(
          (i) => i.name.toLowerCase() === instrumentName.toLowerCase()
        )
        if (inst) {
          const tmpl = allTemplates.find(
            (t) => t.instrument_id === inst.id && t.is_active
          )
          if (tmpl) {
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
          <div className="bg-gradient-to-br from-primary-500 to-primary-700 text-white p-8 text-center">
            <h1 className="text-4xl font-bold mb-2">📅 Practice Plan</h1>
            <p className="text-primary-100 text-lg">{template.name}</p>
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


