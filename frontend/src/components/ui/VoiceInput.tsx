'use client'

import { useEffect, useState } from 'react'
import { Mic, MicOff } from 'lucide-react'
import { cx } from '@/lib/cx'
import {
  useSpeechRecognition,
  type VoiceInputError,
} from './useSpeechRecognition'

/**
 * Append a finalized transcript chunk to a field's current value, inserting a
 * separating space only where one is needed. Consumers own the field state, so
 * the dictated text stays editable like anything typed.
 */
export function appendTranscript(current: string, chunk: string): string {
  const addition = chunk.trim()
  if (!addition) return current
  if (!current) return addition
  return /\s$/.test(current) ? current + addition : `${current} ${addition}`
}

export interface VoiceInputProps {
  /** Finalized transcript chunks — append these to the field. */
  onTranscript: (text: string) => void
  /** Interim (not-yet-final) text, for a live preview. Optional. */
  onInterimTranscript?: (text: string) => void
  /** Recognition errors, normalized. Optional. */
  onError?: (error: VoiceInputError) => void
  /** BCP-47 language tag. Defaults to `en-US`. */
  lang?: string
  /** Extra classes for the button. */
  className?: string
  /** Accessible label. Defaults to a start/stop label based on state. */
  'aria-label'?: string
}

/**
 * Voice-input mic button wrapping the Web Speech API (design-tokens §6). The
 * primary text-entry affordance for notes/reflection fields — typing is the
 * fallback. Renders **nothing** when the API is unavailable (Firefox, some
 * mobile) rather than a disabled button. Recording shows a reduced-motion-safe
 * pulse; a denied mic permission surfaces a brief non-blocking notice.
 *
 * State lives with the consumer: append `onTranscript` chunks to the field.
 */
export function VoiceInput({
  onTranscript,
  onInterimTranscript,
  onError,
  lang,
  className,
  ...aria
}: VoiceInputProps) {
  const [denied, setDenied] = useState(false)

  const { supported, isRecording, toggle } = useSpeechRecognition({
    onTranscript,
    onInterimTranscript,
    lang,
    onError: (error) => {
      if (error === 'not-allowed') setDenied(true)
      onError?.(error)
    },
  })

  // Auto-dismiss the permission notice.
  useEffect(() => {
    if (!denied) return
    const timer = setTimeout(() => setDenied(false), 5000)
    return () => clearTimeout(timer)
  }, [denied])

  if (!supported) return null

  const label =
    aria['aria-label'] ?? (isRecording ? 'Stop voice input' : 'Start voice input')

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => {
          setDenied(false)
          toggle()
        }}
        aria-label={label}
        aria-pressed={isRecording}
        className={cx(
          'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-round transition-colors',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
          isRecording
            ? 'bg-primary-subtle-bg text-primary'
            : 'text-text-link hover:bg-card-bg-inset',
          className,
        )}
      >
        {isRecording ? (
          <MicOff
            size={20}
            strokeWidth={1.5}
            className="motion-safe:animate-voice-pulse"
            aria-hidden
          />
        ) : (
          <Mic size={20} strokeWidth={1.5} aria-hidden />
        )}
      </button>

      {denied && (
        <span
          role="status"
          className="absolute right-0 top-full z-50 mt-2 whitespace-nowrap rounded-md border border-border-default bg-card-bg px-3 py-2 text-xs text-text-secondary shadow-lg"
        >
          Microphone access is needed for voice input.
        </span>
      )}
    </span>
  )
}
