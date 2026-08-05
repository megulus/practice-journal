'use client'

import { useRef, useState } from 'react'
import { useApi } from '@/lib/useApi'
import { cx } from '@/lib/cx'
import type { BlockLog } from '@/lib/types'

const MIN_BPM = 1
const MAX_BPM = 400

/**
 * Smart tempo default on a block row (#181).
 *
 * Pre-fills from `last_tempo_bpm` (the tempo carried over from the user's last
 * session on this block) in muted `text-tertiary`. Confirming — focus then blur
 * without changing it — or adjusting the number persists it as this session's
 * `tempo_bpm` and switches the field to `text-primary`.
 *
 * Saves on blur without asking the parent to refetch: a refetch remounts the
 * whole session and would fight the field the user is still working in.
 */
export function TempoField({
  logId,
  blockLog,
}: {
  logId: number
  blockLog: BlockLog
}) {
  const api = useApi()
  const prefill = blockLog.tempo_bpm ?? blockLog.last_tempo_bpm
  const [value, setValue] = useState(prefill != null ? String(prefill) : '')
  // Confirmed = logged for this session (either already persisted or just now).
  const [confirmed, setConfirmed] = useState(blockLog.tempo_bpm != null)
  const saved = useRef<number | null>(blockLog.tempo_bpm)

  const persist = async (next: number | null) => {
    const previous = saved.current
    saved.current = next
    setConfirmed(next != null)
    try {
      await api.updateBlockLog(logId, blockLog.id, { tempo_bpm: next })
    } catch {
      // Roll back to what the server last accepted rather than showing a
      // confirmed tempo that isn't stored.
      saved.current = previous
      setConfirmed(previous != null)
      setValue(previous != null ? String(previous) : '')
    }
  }

  const handleBlur = () => {
    const digits = value.trim()
    if (digits === '') {
      if (saved.current != null) persist(null)
      else setConfirmed(false)
      return
    }
    const parsed = Math.min(Math.max(Number(digits), MIN_BPM), MAX_BPM)
    if (String(parsed) !== digits) setValue(String(parsed))
    if (parsed === saved.current) return
    persist(parsed)
  }

  return (
    <div className="mt-0.5 flex items-center gap-1">
      <input
        type="text"
        inputMode="numeric"
        value={value}
        // Digits only — the field is a bpm number, and stripping here keeps
        // blur handling free of parse errors.
        onChange={(e) => setValue(e.target.value.replace(/\D/g, '').slice(0, 3))}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        placeholder="—"
        aria-label={`Tempo in bpm for ${blockLog.block_name}`}
        className={cx(
          'w-10 rounded-md border border-border-input bg-input-bg-recessed',
          'px-1 py-0.5 text-xs tabular-nums text-right',
          'placeholder:text-text-tertiary focus:border-border-input-focus focus:outline-none',
          confirmed ? 'text-text-primary' : 'text-text-tertiary'
        )}
      />
      <span className="text-xs text-text-tertiary">bpm</span>
    </div>
  )
}
