'use client'

import { useState } from 'react'
import type { PracticeTemplate } from '@/lib/types'
import CreateTemplateForm from './CreateTemplateForm'

interface TemplatePickerProps {
  templates: PracticeTemplate[]
  onCreateTemplate: (data: { name: string; daysCount: number; description?: string }) => Promise<number>
  onSelect: (templateId: number) => void
}

export default function TemplatePicker({
  templates,
  onCreateTemplate,
  onSelect,
}: TemplatePickerProps) {
  const [showCreate, setShowCreate] = useState(false)

  if (showCreate) {
    return (
      <div className="max-w-md mx-auto">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Create New Template</h2>
        <CreateTemplateForm
          onCreateTemplate={onCreateTemplate}
          onCreated={onSelect}
          onCancel={() => setShowCreate(false)}
        />
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-4">Choose a Template to Edit</h2>
      {templates.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              className="p-4 bg-white border border-gray-200 rounded-lg hover:border-primary-400 hover:shadow-md transition-all text-left"
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-800">{t.name}</span>
                {t.is_active && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                    Active
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                {t.days_count} day{t.days_count !== 1 ? 's' : ''}
              </div>
              {t.description && (
                <div className="text-sm text-gray-500 mt-1">{t.description}</div>
              )}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => setShowCreate(true)}
        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
      >
        + Create New Template
      </button>
    </div>
  )
}
