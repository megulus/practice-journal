'use client'

import { Plus } from 'lucide-react'
import type { TemplateSession } from '@/lib/types'
import { Pill } from './ui'

export default function SessionTabs({
  sessions,
  selectedSessionId,
  onSelect,
  onAdd,
  addDisabled = false,
}: {
  sessions: TemplateSession[]
  selectedSessionId: number | null
  onSelect: (id: number) => void
  onAdd: () => void
  addDisabled?: boolean
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
      {sessions.map((s) => (
        <Pill
          key={s.id}
          variant="instrument"
          active={s.id === selectedSessionId}
          onClick={() => onSelect(s.id)}
          className="whitespace-nowrap"
        >
          {s.name}
        </Pill>
      ))}
      <button
        onClick={onAdd}
        disabled={addDisabled}
        className="shrink-0 flex h-9 w-9 items-center justify-center rounded-md border border-dashed border-border-default text-text-tertiary transition-colors hover:border-border-input hover:text-text-secondary disabled:opacity-50"
        aria-label="Add session"
      >
        <Plus size={16} aria-hidden />
      </button>
    </div>
  )
}
