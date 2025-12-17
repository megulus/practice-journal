'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import type { Instrument, PracticeTemplate, ExerciseBlock } from '@/lib/types'

export default function LogPracticePage() {
  const params = useParams()
  const router = useRouter()
  const instrumentName = params.instrument as string
  const [template, setTemplate] = useState<PracticeTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    dayNumber: 1,
    duration: '',
    warmup: '',
    scales: '',
    techA: '',
    techB: '',
    repertoire: '',
    notes: '',
  })

  const [dayExercises, setDayExercises] = useState<{
    blockA: ExerciseBlock | null
    blockB: ExerciseBlock | null
  }>({ blockA: null, blockB: null })

  useEffect(() => {
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
          loadDayExercises(tmpl, 1)
        }
        setLoading(false)
      })
      .catch((err) => {
        console.error(err)
        setLoading(false)
      })
  }, [instrumentName])

  const loadDayExercises = (tmpl: PracticeTemplate, dayNum: number) => {
    if (tmpl.practice_days) {
      const day = tmpl.practice_days.find((d) => d.day_number === dayNum)
      if (day) {
        setDayExercises({
          blockA: day.exercise_blocks.find((b) => b.block_type === 'blockA') || null,
          blockB: day.exercise_blocks.find((b) => b.block_type === 'blockB') || null,
        })
      }
    }
  }

  const handleDayChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const dayNum = parseInt(e.target.value)
    setFormData({ ...formData, dayNumber: dayNum })
    if (template) {
      loadDayExercises(template, dayNum)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!template) return

    setSubmitting(true)

    try {
      await api.createLog({
        template_id: template.id,
        day_number: formData.dayNumber,
        practice_date: formData.date,
        duration_minutes: parseInt(formData.duration),
        notes: formData.notes,
        log_details: [
          { section_type: 'warmup', content: formData.warmup },
          { section_type: 'scales', content: formData.scales },
          { section_type: 'techA', content: formData.techA },
          { section_type: 'techB', content: formData.techB },
          { section_type: 'repertoire', content: formData.repertoire },
        ].filter((d) => d.content),
      })

      alert('Practice log saved! 🎉')
      // Reset form
      setFormData({
        date: new Date().toISOString().split('T')[0],
        dayNumber: 1,
        duration: '',
        warmup: '',
        scales: '',
        techA: '',
        techB: '',
        repertoire: '',
        notes: '',
      })
      loadDayExercises(template, 1)
    } catch (err) {
      console.error(err)
      alert('Error saving log')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-primary-100 to-secondary-100 p-8">
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-gray-600">Loading...</p>
        </div>
      </main>
    )
  }

  if (!template) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-primary-100 to-secondary-100 p-8">
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-red-600">No active template found</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-primary-100 to-secondary-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-br from-green-500 to-green-700 text-white p-8 text-center">
            <h1 className="text-4xl font-bold mb-2">✏️ Log Practice</h1>
            <p className="text-green-100 text-lg">Record today's session</p>
          </div>

          <form onSubmit={handleSubmit} className="p-8">
            <div className="mb-6">
              <label className="block font-semibold text-gray-700 mb-2">Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-500 focus:outline-none"
                required
              />
            </div>

            <div className="mb-6">
              <label className="block font-semibold text-gray-700 mb-2">
                Rotation Day (1-{template.days_count})
              </label>
              <select
                value={formData.dayNumber}
                onChange={handleDayChange}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-500 focus:outline-none"
                required
              >
                {Array.from({ length: template.days_count }, (_, i) => i + 1).map((day) => {
                  const dayData = template.practice_days?.find((d) => d.day_number === day)
                  return (
                    <option key={day} value={day}>
                      Day {day}{dayData ? `: ${dayData.title}` : ''}
                    </option>
                  )
                })}
              </select>
            </div>

            <div className="mb-6">
              <label className="block font-semibold text-gray-700 mb-2">
                Practice Duration (minutes)
              </label>
              <input
                type="number"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                placeholder="e.g., 45"
                min="1"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-500 focus:outline-none"
                required
              />
            </div>

            <div className="mb-6">
              <label className="block font-semibold text-gray-700 mb-2">Warm-up</label>
              <textarea
                value={formData.warmup}
                onChange={(e) => setFormData({ ...formData, warmup: e.target.value })}
                placeholder="What did you work on in warm-up?"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-500 focus:outline-none resize-y min-h-[100px]"
              />
            </div>

            <div className="mb-6">
              <label className="block font-semibold text-gray-700 mb-2">Scales & Arpeggios</label>
              <textarea
                value={formData.scales}
                onChange={(e) => setFormData({ ...formData, scales: e.target.value })}
                placeholder="Which keys? What patterns?"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-500 focus:outline-none resize-y min-h-[100px]"
              />
            </div>

            <div className="mb-6">
              <label className="block font-semibold text-gray-700 mb-2">Technical Focus A</label>
              <select
                value={formData.techA}
                onChange={(e) => setFormData({ ...formData, techA: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-500 focus:outline-none"
              >
                <option value="">Select exercise...</option>
                {dayExercises.blockA?.exercises
                  .sort((a, b) => a.display_order - b.display_order)
                  .map((ex) => (
                    <option key={ex.id} value={ex.exercise_text}>
                      {ex.exercise_text}
                    </option>
                  ))}
              </select>
            </div>

            <div className="mb-6">
              <label className="block font-semibold text-gray-700 mb-2">
                Technical Focus B (if time allowed)
              </label>
              <select
                value={formData.techB}
                onChange={(e) => setFormData({ ...formData, techB: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-500 focus:outline-none"
              >
                <option value="">Select exercise (if applicable)...</option>
                {dayExercises.blockB?.exercises
                  .sort((a, b) => a.display_order - b.display_order)
                  .map((ex) => (
                    <option key={ex.id} value={ex.exercise_text}>
                      {ex.exercise_text}
                    </option>
                  ))}
              </select>
            </div>

            <div className="mb-6">
              <label className="block font-semibold text-gray-700 mb-2">Repertoire Work</label>
              <textarea
                value={formData.repertoire}
                onChange={(e) => setFormData({ ...formData, repertoire: e.target.value })}
                placeholder="What sections did you practice? What was the focus?"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-500 focus:outline-none resize-y min-h-[100px]"
              />
            </div>

            <div className="mb-6">
              <label className="block font-semibold text-gray-700 mb-2">
                Notes & Observations
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Breakthroughs, challenges, things to remember for next time..."
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-500 focus:outline-none resize-y min-h-[100px]"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-green-500 text-white py-4 rounded-lg font-semibold text-lg hover:bg-green-600 transition-all disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {submitting ? 'Saving...' : 'Save Practice Log'}
            </button>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => router.push(`/${instrumentName}`)}
                className="text-primary-600 hover:text-primary-700 font-semibold"
              >
                ← Back to Dashboard
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  )
}


