'use client'

import type { TemplateSession } from '@/lib/types'

export default function SessionTabs({
  sessions,
  selectedSessionId,
  onSelect,
  onAdd,
}: {
  sessions: TemplateSession[]
  selectedSessionId: number | null
  onSelect: (id: number) => void
  onAdd: () => void
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
      {sessions.map((s) => {
        const active = s.id === selectedSessionId
        return (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap border transition-colors ${
              active
                ? 'bg-primary-100 border-primary-300 text-primary-800'
                : 'bg-white border-gray-200 text-gray-600'
            }`}
          >
            {s.name}
          </button>
        )
      })}
      <button
        onClick={onAdd}
        className="shrink-0 w-8 h-8 rounded-full border border-dashed border-gray-300 text-gray-400 text-sm flex items-center justify-center hover:border-primary-300 hover:text-primary-600"
        aria-label="Add session"
      >
        +
      </button>
    </div>
  )
}
