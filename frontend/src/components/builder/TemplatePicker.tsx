'use client'

import { useState } from 'react'
import type { PracticeTemplate } from '@/lib/types'
import CreateTemplateForm from './CreateTemplateForm'
import ConfirmDialog from '@/components/ConfirmDialog'

interface TemplatePickerProps {
  templates: PracticeTemplate[]
  onCreateTemplate: (data: { name: string; daysCount: number; description?: string }) => Promise<number>
  onSelect: (templateId: number) => void
  onDelete: (templateId: number) => void
  onArchive: (templateId: number) => void
  onUnarchive: (templateId: number) => void
  showArchived: boolean
  onToggleShowArchived: () => void
}

export default function TemplatePicker({
  templates,
  onCreateTemplate,
  onSelect,
  onDelete,
  onArchive,
  onUnarchive,
  showArchived,
  onToggleShowArchived,
}: TemplatePickerProps) {
  const [showCreate, setShowCreate] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

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

  const activeTemplates = templates.filter((t) => t.is_active)
  const archivedTemplates = templates.filter((t) => !t.is_active)
  const displayedTemplates = showArchived ? archivedTemplates : activeTemplates

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-4">Choose a Template to Edit</h2>

      {/* Active / Archived toggle */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => showArchived && onToggleShowArchived()}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            !showArchived
              ? 'bg-white text-gray-800 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Active ({activeTemplates.length})
        </button>
        <button
          onClick={() => !showArchived && onToggleShowArchived()}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            showArchived
              ? 'bg-white text-gray-800 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Archived ({archivedTemplates.length})
        </button>
      </div>

      {displayedTemplates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {displayedTemplates.map((t) => (
            <div
              key={t.id}
              className="p-4 bg-white border border-gray-200 rounded-lg hover:border-primary-400 hover:shadow-md transition-all"
            >
              <button
                onClick={() => onSelect(t.id)}
                className="w-full text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-800">{t.name}</span>
                  {t.is_active ? (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                      Active
                    </span>
                  ) : (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                      Archived
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

              {/* Action buttons */}
              {!t.is_system && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                  {t.is_active ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onArchive(t.id)
                      }}
                      className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                      title="Archive template"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                      </svg>
                      Archive
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onUnarchive(t.id)
                      }}
                      className="text-xs text-primary-600 hover:text-primary-800 flex items-center gap-1"
                      title="Unarchive template"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Unarchive
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setConfirmDeleteId(t.id)
                    }}
                    className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                    title="Delete template"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500 mb-6">
          {showArchived ? 'No archived templates.' : 'No templates yet.'}
        </p>
      )}

      {!showArchived && (
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
        >
          + Create New Template
        </button>
      )}

      {confirmDeleteId !== null && (
        <ConfirmDialog
          title="Delete Template?"
          message={
            <p>
              This will permanently delete this template. Your practice logs will be preserved.
              <br />
              <span className="text-red-600 text-sm mt-2 block">This action cannot be undone.</span>
            </p>
          }
          confirmLabel="Delete Template"
          confirmVariant="danger"
          onConfirm={() => {
            onDelete(confirmDeleteId)
            setConfirmDeleteId(null)
          }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  )
}
