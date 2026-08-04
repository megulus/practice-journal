'use client'

import { useCallback, useEffect, useState } from 'react'
import { useApi } from '@/lib/useApi'
import type { Piece } from '@/lib/types'
import { AddPiece } from './AddPiece'
import { PieceCard } from './PieceCard'

/**
 * An instrument's repertoire library (spec §5.8): every piece the user has
 * logged or planned, each expandable to its spots. This is the canonical
 * place to manage repertoire outside of the active session and the template
 * editor, which only surface the slice they need.
 */
export function RepertoireLibrary({ instrumentId }: { instrumentId: number }) {
  const api = useApi()
  const [pieces, setPieces] = useState<Piece[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setPieces(await api.listPieces(instrumentId))
      setError(null) // clear any prior (load or write) error on success
    } catch {
      setError("Couldn't load your repertoire. Please try again.")
    }
  }, [api, instrumentId])

  useEffect(() => {
    load()
  }, [load])

  const addPiece = async (name: string, composer: string) => {
    try {
      await api.createPiece(instrumentId, {
        name,
        composer_or_source: composer || undefined,
      })
    } catch {
      setError("Couldn't add the piece. Please try again.")
      return false
    }
    await load()
    return true
  }

  return (
    <div className="space-y-3">
      {/* Non-blocking error banner (load or write failures) */}
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-card-bg-inset px-3 py-2 text-sm text-danger-text"
        >
          {error}
        </p>
      )}

      {pieces === null && !error && (
        <p className="text-sm text-text-secondary">Loading…</p>
      )}

      {pieces !== null && pieces.length === 0 && (
        <p className="text-sm text-text-secondary">
          No pieces yet. Add one here, or add a repertoire block to a plan and
          it will show up in this library.
        </p>
      )}

      {pieces !== null && pieces.length > 0 && (
        <ul className="space-y-3">
          {pieces.map((piece) => (
            <li key={piece.id}>
              <PieceCard piece={piece} onChange={load} onError={setError} />
            </li>
          ))}
        </ul>
      )}

      <AddPiece onAdd={addPiece} />
    </div>
  )
}
