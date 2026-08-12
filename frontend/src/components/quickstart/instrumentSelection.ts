import type { Instrument } from '@/lib/types'

/**
 * What step 1 is holding: one of the user's existing instruments, one of the
 * common presets, or "Other…" plus a typed name.
 */
export type InstrumentSelection =
  | { kind: 'existing'; id: number }
  | { kind: 'preset'; name: string }
  | { kind: 'other' }

export interface ResolvedInstrument {
  /** Present only when reusing an instrument the user already has. */
  id?: number
  name: string
}

/** Key used to identify a selection in the pill grid. */
export function selectionKey(selection: InstrumentSelection): string {
  switch (selection.kind) {
    case 'existing':
      return `existing:${selection.id}`
    case 'preset':
      return `preset:${selection.name}`
    case 'other':
      return 'other'
  }
}

/**
 * Turn a selection into something the API can take, or `null` when the step
 * isn't answered yet — nothing picked, "Other…" left blank, or a stale id.
 */
export function resolveInstrument(
  selection: InstrumentSelection | null,
  instruments: Instrument[],
  otherName: string,
): ResolvedInstrument | null {
  if (!selection) return null

  if (selection.kind === 'existing') {
    const match = instruments.find((i) => i.id === selection.id)
    return match ? { id: match.id, name: match.name } : null
  }

  if (selection.kind === 'preset') return { name: selection.name }

  const typed = otherName.trim()
  return typed ? { name: typed } : null
}
