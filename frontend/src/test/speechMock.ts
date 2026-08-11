import { vi } from 'vitest'

/**
 * Controllable stub for the Web Speech API's `SpeechRecognition`.
 *
 * The browser API is absent in jsdom, so every voice-input test installs this
 * on `window` and drives recognition by hand: `emitResult` pushes transcript
 * chunks, `emitError` simulates a denied mic or a dropped connection.
 */
export class MockSpeechRecognition {
  /** The most recently constructed instance — the one the hook is driving. */
  static last: MockSpeechRecognition | null = null

  lang = ''
  continuous = false
  interimResults = false
  onresult: ((e: unknown) => void) | null = null
  onerror: ((e: unknown) => void) | null = null
  onend: (() => void) | null = null
  start = vi.fn()
  stop = vi.fn(() => this.onend?.())
  abort = vi.fn()

  constructor() {
    MockSpeechRecognition.last = this
  }

  emitResult(chunks: { transcript: string; isFinal: boolean }[]) {
    const results = chunks.map((c) => ({
      0: { transcript: c.transcript },
      isFinal: c.isFinal,
      length: 1,
    }))
    this.onresult?.({ resultIndex: 0, results })
  }

  emitError(error: string) {
    this.onerror?.({ error })
  }
}

type SpeechWindow = {
  SpeechRecognition?: unknown
  webkitSpeechRecognition?: unknown
}

/** Make the Web Speech API available (call from `beforeEach`). */
export function installSpeechMock() {
  MockSpeechRecognition.last = null
  ;(window as unknown as SpeechWindow).SpeechRecognition = MockSpeechRecognition
}

/** Remove both API spellings, so `supported` reports false (Firefox et al.). */
export function uninstallSpeechMock() {
  delete (window as unknown as SpeechWindow).SpeechRecognition
  delete (window as unknown as SpeechWindow).webkitSpeechRecognition
  MockSpeechRecognition.last = null
}

/**
 * Speak `text` into whichever recognition session is currently active, as a
 * finalized chunk. Must be wrapped in `act()` by the caller.
 */
export function dictate(text: string) {
  MockSpeechRecognition.last?.emitResult([{ transcript: text, isFinal: true }])
}

/**
 * Emit `text` as an interim (not-yet-final) result — what the engine shows
 * while it's still deciding. Must be wrapped in `act()` by the caller.
 */
export function dictateInterim(text: string) {
  MockSpeechRecognition.last?.emitResult([{ transcript: text, isFinal: false }])
}
