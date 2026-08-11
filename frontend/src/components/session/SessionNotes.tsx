'use client'

import { useEffect, useState, useCallback } from 'react'
import { useApi } from '@/lib/useApi'
import {
  TextArea,
  VoiceInput,
  useDictation,
  useSerializedSave,
} from '@/components/ui'

// ---------------------------------------------------------------------------
// Session notes
// ---------------------------------------------------------------------------

export function SessionNotes({
  logId,
  initialNotes,
  pendingFlushes,
}: {
  logId: number
  initialNotes: string
  pendingFlushes: React.RefObject<Set<() => Promise<void>>>
}) {
  const api = useApi()
  const [notes, setNotes] = useState(initialNotes)

  // Dictation queues a save per finalized phrase, so these are serialized:
  // concurrent PATCHes to the same log have no guaranteed apply order.
  const { save: saveNotes } = useSerializedSave(
    useCallback(
      async (value: string) => {
        await api.updatePractice(logId, { notes: value || undefined })
      },
      [api, logId],
    ),
  )

  const handleSave = useCallback(() => saveNotes(notes), [saveNotes, notes])

  // Dictation persists on commit — the mic click blurs the field, so the
  // blur-save alone would only ever write the pre-dictation value.
  const dictation = useDictation({
    value: notes,
    onChange: setNotes,
    onCommit: saveNotes,
  })

  // Register flush so Finish saves pending session notes
  useEffect(() => {
    const flushes = pendingFlushes.current
    if (notes !== initialNotes) {
      flushes?.add(handleSave)
      return () => { flushes?.delete(handleSave) }
    }
  }, [notes, initialNotes, handleSave, pendingFlushes])

  return (
    <div className="flex items-start gap-2">
      <TextArea
        value={dictation.value}
        onChange={(e) => dictation.onChange(e.target.value)}
        onBlur={handleSave}
        placeholder="Notes — breakthroughs, challenges, ideas..."
        rows={3}
        className="flex-1"
      />
      <VoiceInput {...dictation.voiceProps} aria-label="Dictate session notes" />
    </div>
  )
}
