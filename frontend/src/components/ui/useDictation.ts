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
  onCommit?: (next: string) => void
}

export interface DictationBinding {
  /** Value to render in the field: committed text plus any live interim text. */
  value: string
  /** Wire to the field's change handler, in place of the raw setState. */
  onChange: (next: string) => void
  /** Spread onto `<VoiceInput>`. */
  voiceProps: {
    onTranscript: (text: string) => void
    onInterimTranscript: (text: string) => void
  }
}

/**
 * Streams speech into a text field (design-tokens §6: "text streams into the
 * field as it's recognized").
 *
 * Interim results are held separately from the committed value and rendered as
 * a trailing preview, so when the engine finalizes a chunk the preview is
 * **replaced** rather than appended twice.
 *
 * If the user types while a preview is showing, their edit wins: what they see
 * becomes the committed value and the interim preview is dropped. The final
 * chunk for that preview is then suppressed, since its words are already in
 * the field — otherwise the phrase would land a second time.
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

  // Set when the user edits over a preview: the matching final chunk is
  // already in the field and must not be appended again.
  const skipNextFinal = useRef(false)

  const handleTranscript = useCallback(
    (text: string) => {
      setInterim('')
      if (skipNextFinal.current) {
        skipNextFinal.current = false
        return
      }
      const next = appendTranscript(valueRef.current, text)
      valueRef.current = next
      onChange(next)
      onCommit?.(next)
    },
    [onChange, onCommit],
  )

  const handleInterim = useCallback((text: string) => {
    setInterim(text)
  }, [])

  const handleChange = useCallback(
    (next: string) => {
      if (interimRef.current) {
        // The preview was visible in what the user just edited, so it's part
        // of `next` now. Drop the preview and ignore its final chunk.
        setInterim('')
        skipNextFinal.current = true
      }
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
    },
  }
}
