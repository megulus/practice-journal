'use client'

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { createPortal } from 'react-dom'
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
  /** Fired once when a session ends for any reason. Optional. */
  onEnd?: () => void
  /** BCP-47 language tag. Defaults to `en-US`. */
  lang?: string
  /** Extra classes for the button. */
  className?: string
  /** Accessible label. Defaults to a start/stop label based on state. */
  'aria-label'?: string
}

/** Gap between the mic and its notice, in px. */
const NOTICE_GAP = 8

// useLayoutEffect warns during SSR; the effect only measures the DOM, so
// falling back to useEffect on the server is safe.
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect

/**
 * Voice-input mic button wrapping the Web Speech API (design-tokens §6). The
 * primary text-entry affordance for notes/reflection fields — typing is the
 * fallback. Renders **nothing** when the API is unavailable (Firefox, some
 * mobile) rather than a disabled button. Recording shows a reduced-motion-safe
 * pulse; a denied mic permission surfaces a brief non-blocking notice.
 *
 * State lives with the consumer: append `onTranscript` chunks to the field.
 * Pair with {@link useDictation} to also stream interim results and persist.
 */
export function VoiceInput({
  onTranscript,
  onInterimTranscript,
  onError,
  onEnd,
  lang,
  className,
  ...aria
}: VoiceInputProps) {
  const [denied, setDenied] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const noticeRef = useRef<HTMLSpanElement>(null)
  const [noticePos, setNoticePos] = useState<CSSProperties | null>(null)

  const { supported, isRecording, toggle } = useSpeechRecognition({
    onTranscript,
    onInterimTranscript,
    onEnd,
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

  // Anchor the portaled notice to the mic in viewport coordinates, flipping
  // above the button when there's no room below.
  useIsomorphicLayoutEffect(() => {
    if (!denied) {
      setNoticePos(null)
      return
    }
    const place = () => {
      const anchor = buttonRef.current
      if (!anchor) return
      const rect = anchor.getBoundingClientRect()
      const height = noticeRef.current?.offsetHeight ?? 0
      const below = rect.bottom + NOTICE_GAP
      const flip = below + height > window.innerHeight
      setNoticePos({
        position: 'fixed',
        top: flip ? Math.max(NOTICE_GAP, rect.top - NOTICE_GAP - height) : below,
        left: rect.right,
        // Right-align to the mic without needing to measure our own width.
        transform: 'translateX(-100%)',
      })
    }
    place()
    // `true` captures scrolls on any ancestor, not just the window.
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [denied])

  if (!supported) return null

  const label =
    aria['aria-label'] ?? (isRecording ? 'Stop voice input' : 'Start voice input')

  // The notice is portaled to <body> rather than positioned relative to the
  // mic: several call sites sit inside an `overflow-hidden` ancestor (the
  // quick-add form is the last child of SectionCard's Card) which would clip
  // an absolutely-positioned notice away entirely. #179 requires the denied
  // -permission notice to be visible at *every* field.
  const notice =
    denied && typeof document !== 'undefined'
      ? createPortal(
          <span
            ref={noticeRef}
            role="status"
            style={{
              ...(noticePos ?? { position: 'fixed', top: 0, left: 0 }),
              // Hide until measured so it can't flash at the wrong spot.
              visibility: noticePos ? 'visible' : 'hidden',
              // It floats over page content for 5s at document level — never
              // let it swallow a tap meant for whatever is underneath.
              pointerEvents: 'none',
            }}
            className="z-50 whitespace-nowrap rounded-md border border-border-default bg-card-bg px-3 py-2 text-xs text-text-secondary shadow-lg"
          >
            Microphone access is needed for voice input.
          </span>,
          document.body,
        )
      : null

  return (
    <>
      <button
        ref={buttonRef}
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
      {notice}
    </>
  )
}
