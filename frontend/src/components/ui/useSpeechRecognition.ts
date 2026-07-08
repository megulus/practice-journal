'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// Minimal Web Speech API typings (not in the default TS DOM lib). Only the
// surface this hook uses is declared.
// ---------------------------------------------------------------------------
interface SpeechRecognitionAlternativeLike {
  readonly transcript: string
}
interface SpeechRecognitionResultLike {
  readonly isFinal: boolean
  readonly length: number
  readonly [index: number]: SpeechRecognitionAlternativeLike
}
interface SpeechRecognitionResultListLike {
  readonly length: number
  readonly [index: number]: SpeechRecognitionResultLike
}
interface SpeechRecognitionEventLike {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultListLike
}
interface SpeechRecognitionErrorEventLike {
  readonly error: string
}
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** Normalized error kinds callers may care about. */
export type VoiceInputError =
  | 'not-allowed'
  | 'no-speech'
  | 'audio-capture'
  | 'network'
  | 'aborted'
  | 'other'

export interface UseSpeechRecognitionOptions {
  /** Finalized transcript chunks — append these to the field. */
  onTranscript: (text: string) => void
  /** Interim (not-yet-final) text, for a live preview. Optional. */
  onInterimTranscript?: (text: string) => void
  /** Recognition errors, normalized. Optional. */
  onError?: (error: VoiceInputError) => void
  /** BCP-47 language tag. Defaults to `en-US`. */
  lang?: string
}

export interface SpeechRecognitionControls {
  /** False on the server and where the Web Speech API is unavailable. */
  supported: boolean
  isRecording: boolean
  start: () => void
  stop: () => void
  toggle: () => void
}

function normalizeError(error: string): VoiceInputError {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'not-allowed'
    case 'no-speech':
      return 'no-speech'
    case 'audio-capture':
      return 'audio-capture'
    case 'network':
      return 'network'
    case 'aborted':
      return 'aborted'
    default:
      return 'other'
  }
}

/**
 * Web Speech API wrapper. Detects availability after mount (SSR-safe: reports
 * `supported: false` on the server and first client render), manages a single
 * recognition session, and streams results to the callbacks.
 *
 * Callbacks are read from a ref, so passing fresh inline handlers each render
 * never restarts recognition.
 */
export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions,
): SpeechRecognitionControls {
  const [supported, setSupported] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)

  const optsRef = useRef(options)
  optsRef.current = options

  useEffect(() => {
    setSupported(getSpeechRecognitionCtor() != null)
  }, [])

  const stop = useCallback(() => {
    // The ref is cleared by onend (async), not here. Between stop() and onend
    // a re-toggle routes back through stop() — a harmless momentary no-op, not
    // a leak or double-start (start() guards on the ref).
    recognitionRef.current?.stop()
    setIsRecording(false)
  }, [])

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor || recognitionRef.current) return

    const recognition = new Ctor()
    recognition.lang = optsRef.current.lang ?? 'en-US'
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onresult = (e) => {
      let finalText = ''
      let interimText = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i]
        const transcript = result[0]?.transcript ?? ''
        if (result.isFinal) finalText += transcript
        else interimText += transcript
      }
      if (finalText) optsRef.current.onTranscript(finalText)
      if (interimText) optsRef.current.onInterimTranscript?.(interimText)
    }
    recognition.onerror = (e) => {
      // Clear the active-session ref on error so a failed session (e.g. a
      // denied mic) can't permanently block restarts if the engine skips
      // onend afterward. Identity-guarded so a late event from a previous
      // session never nulls a newer one's ref.
      if (recognitionRef.current === recognition) recognitionRef.current = null
      optsRef.current.onError?.(normalizeError(e.error))
      setIsRecording(false)
    }
    recognition.onend = () => {
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null
        setIsRecording(false)
      }
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
      setIsRecording(true)
    } catch {
      // start() throws if called while already started — treat as no-op.
      recognitionRef.current = null
      setIsRecording(false)
    }
  }, [])

  const toggle = useCallback(() => {
    if (recognitionRef.current) stop()
    else start()
  }, [start, stop])

  // Tear down an in-flight session on unmount.
  useEffect(() => {
    return () => {
      const r = recognitionRef.current
      if (r) {
        r.onresult = null
        r.onerror = null
        r.onend = null
        try {
          r.abort()
        } catch {
          // ignore
        }
        recognitionRef.current = null
      }
    }
  }, [])

  return { supported, isRecording, start, stop, toggle }
}
