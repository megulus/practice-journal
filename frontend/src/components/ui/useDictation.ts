'use client'

import { useCallback, useRef, useState } from 'react'
import { appendTranscript } from './VoiceInput'

export interface UseDictationOptions {
  /** The field's committed value (the consumer's state). */
  value: string
  /** Commit a new value — usually the consumer's setState. */
  onChange: (next: string) => void
  /**
   * Called with the committed value each time a transcript chunk finalizes.
   * Use it to persist: clicking the mic blurs the field, so a blur-save alone
   * would write the *pre*-dictation value and never fire again (focus stays on
   * the mic), losing dictated text that typed text would have kept.
   */
  onCommit?: (next: string) => void | Promise<unknown>
}

export interface DictationBinding {
  /** Value to render in the field: committed text plus any live preview. */
  value: string
  /** Wire to the field's change handler, in place of the raw setState. */
  onChange: (next: string) => void
  /** Spread onto `<VoiceInput>`. */
  voiceProps: {
    onTranscript: (text: string) => void
    onInterimTranscript: (text: string) => void
    onEnd: () => void
  }
}

/**
 * Re-derive the committed value after the user edits a field that is showing
 * an interim preview.
 *
 * The preview is a trailing overlay on the *displayed* text and must never
 * become part of the committed value. The edit is treated as one replacement:
 * the untouched head and tail around it fall out of the longest common prefix
 * and suffix, and the result keeps only characters that came from the
 * committed region (indices `< committedLength`) plus whatever the user
 * actually inserted. Overlay characters are dropped wherever they survived.
 *
 * With no overlay (`committedLength === displayed.length`) this reconstructs
 * `next` exactly, so it is safe to run on every change.
 *
 * Exported for direct testing.
 */
export function stripPreview(
  displayed: string,
  next: string,
  committedLength: number,
): string {
  const displayLength = displayed.length

  let prefix = 0
  while (
    prefix < displayLength &&
    prefix < next.length &&
    displayed[prefix] === next[prefix]
  ) {
    prefix++
  }

  let suffix = 0
  while (
    suffix < displayLength - prefix &&
    suffix < next.length - prefix &&
    displayed[displayLength - 1 - suffix] === next[next.length - 1 - suffix]
  ) {
    suffix++
  }

  const head = displayed.slice(0, Math.min(prefix, committedLength))
  const inserted = next.slice(prefix, next.length - suffix)
  // Surviving tail characters only count when they came from the committed
  // region; anything at index >= committedLength is overlay.
  const tailStart = displayLength - suffix
  const tail = tailStart < committedLength
    ? displayed.slice(tailStart, committedLength)
    : ''

  return head + inserted + tail
}

/**
 * Streams speech into a text field (design-tokens §6: "text streams into the
 * field as it's recognized").
 *
 * The ownership rule is that **interim text is an ephemeral overlay that never
 * merges into the committed value**. It is held in separate state and rendered
 * as a trailing preview; a finalized chunk always appends to the committed
 * value, so a final that extends its own preview keeps every word. Because
 * nothing is ever provisionally merged, there is no pending-chunk suppression
 * to get out of sync — an edit made mid-preview can't swallow words from a
 * later utterance.
 *
 * A user edit during a preview discards only that preview (see
 * {@link stripPreview}); the edit itself applies to the committed value.
 *
 * When a session ends without finalizing — stopped early, `no-speech`,
 * `network` — the preview is unconfirmed text that never belonged to the
 * value, so it is dropped rather than flushed. Every persistence path (blur,
 * the Finish flush, form submits) reads the committed value, and this keeps
 * them all in agreement.
 */
export function useDictation({
  value,
  onChange,
  onCommit,
}: UseDictationOptions): DictationBinding {
  const [interim, setInterim] = useState('')

  // Mirrors of the live values, so the callbacks below can stay stable and
  // still read fresh state (transcripts arrive outside React's event flow).
  const valueRef = useRef(value)
  valueRef.current = value
  const interimRef = useRef(interim)
  interimRef.current = interim

  const handleTranscript = useCallback(
    (text: string) => {
      setInterim('')
      const next = appendTranscript(valueRef.current, text)
      valueRef.current = next
      onChange(next)
      // A failed background save isn't fatal — blur and the Finish flush
      // retry — but it must not surface as an unhandled rejection.
      const saved = onCommit?.(next)
      if (saved && typeof (saved as Promise<unknown>).catch === 'function') {
        ;(saved as Promise<unknown>).catch(() => {})
      }
    },
    [onChange, onCommit],
  )

  const handleInterim = useCallback((text: string) => {
    setInterim(text)
  }, [])

  const handleEnd = useCallback(() => {
    setInterim('')
  }, [])

  const handleChange = useCallback(
    (nextDisplayed: string) => {
      const committed = valueRef.current
      const shown = interimRef.current
        ? appendTranscript(committed, interimRef.current)
        : committed
      const next = stripPreview(shown, nextDisplayed, committed.length)
      if (interimRef.current) setInterim('')
      valueRef.current = next
      onChange(next)
    },
    [onChange],
  )

  return {
    value: interim ? appendTranscript(value, interim) : value,
    onChange: handleChange,
    voiceProps: {
      onTranscript: handleTranscript,
      onInterimTranscript: handleInterim,
      onEnd: handleEnd,
    },
  }
}
