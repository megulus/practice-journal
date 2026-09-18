/**
 * The provider abstraction the findings note recommends for the real repo:
 * ONE interface, TWO implementations, picked at runtime by platform.
 *
 * Shaped to match what Kantelo's existing `useSpeechRecognition` hook already
 * exposes (`supported`, `start`, `stop`, transcript + error callbacks) so the
 * real port is "swap the innards of the hook", not "rewrite every caller".
 */
export type VoiceError =
  | 'not-allowed'
  | 'no-speech'
  | 'audio-capture'
  | 'network'
  | 'aborted'
  | 'unavailable'
  | 'other'

export interface VoiceCallbacks {
  /** Finalized chunk — append to the field. */
  onTranscript: (text: string) => void
  /** Interim text, for a live preview. */
  onInterimTranscript?: (text: string) => void
  onError?: (error: VoiceError) => void
  onEnd?: () => void
}

export interface VoiceProvider {
  /** Which implementation this is — surfaced in the harness for evidence. */
  readonly name: 'web-speech' | 'capacitor-native' | 'unsupported'
  /**
   * Async because the native plugin can only answer after a bridge round trip.
   * Kantelo's current hook answers synchronously off `'webkitSpeechRecognition'
   * in window` — that is the part that has to change.
   */
  isAvailable(): Promise<boolean>
  /** Native needs an explicit permission grant; web piggybacks on getUserMedia. */
  ensurePermission(): Promise<'granted' | 'denied' | 'prompt' | 'unknown'>
  start(cb: VoiceCallbacks, opts?: { lang?: string }): Promise<void>
  stop(): Promise<void>
}
