'use client'

import { useState } from 'react'

interface CreateTemplateFormProps {
  onCreateTemplate: (data: { name: string; daysCount: number; description?: string }) => Promise<number>
  onCreated: (templateId: number) => void
  onCancel: () => void
}

export default function CreateTemplateForm({
  onCreateTemplate,
  onCreated,
  onCancel,
}: CreateTemplateFormProps) {
  const [name, setName] = useState('')
  const [daysCount, setDaysCount] = useState(3)
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSubmitting(true)
    setError('')
    try {
      const templateId = await onCreateTemplate({
        name: name.trim(),
        daysCount,
        description: description.trim() || undefined,
      })
      onCreated(templateId)
    } catch (err) {
      setError('Failed to create template. Please try again.')
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded text-red-700 text-sm">
          {error}
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Template Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400"
          placeholder="e.g. Weekly Practice Plan"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Number of Days
        </label>
        <input
          type="number"
          value={daysCount}
          onChange={(e) => setDaysCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
          className="w-24 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400"
          min={1}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description (optional)
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400"
          rows={2}
          placeholder="Describe this practice template..."
        />
      </div>
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting || !name.trim()}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium"
        >
          {submitting ? 'Creating...' : 'Create Template'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-600 hover:text-gray-800"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
