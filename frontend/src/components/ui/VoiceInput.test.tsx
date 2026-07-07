import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from '@testing-library/react'
import { render, screen, userEvent } from '@/test/utils'
import { VoiceInput } from './VoiceInput'

// ---------------------------------------------------------------------------
// Controllable Web Speech API mock
// ---------------------------------------------------------------------------
type Chunk = { transcript: string; isFinal: boolean }

class MockSpeechRecognition {
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

  emitResult(chunks: Chunk[]) {
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

beforeEach(() => {
  MockSpeechRecognition.last = null
  ;(window as unknown as { SpeechRecognition: unknown }).SpeechRecognition =
    MockSpeechRecognition
})

afterEach(() => {
  delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition
  delete (window as unknown as { webkitSpeechRecognition?: unknown })
    .webkitSpeechRecognition
})

describe('VoiceInput', () => {
  it('renders nothing when the Web Speech API is unavailable', () => {
    delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition
    const { container } = render(<VoiceInput onTranscript={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a mic button when supported', () => {
    render(<VoiceInput onTranscript={vi.fn()} />)
    expect(
      screen.getByRole('button', { name: 'Start voice input' }),
    ).toBeInTheDocument()
  })

  it('starts and stops recording on click', async () => {
    const user = userEvent.setup()
    render(<VoiceInput onTranscript={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Start voice input' }))
    expect(MockSpeechRecognition.last?.start).toHaveBeenCalledOnce()
    const recording = screen.getByRole('button', { name: 'Stop voice input' })
    expect(recording).toHaveAttribute('aria-pressed', 'true')

    await user.click(recording)
    expect(MockSpeechRecognition.last?.stop).toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: 'Start voice input' }),
    ).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onTranscript with finalized text only', async () => {
    const onTranscript = vi.fn()
    const onInterim = vi.fn()
    const user = userEvent.setup()
    render(
      <VoiceInput onTranscript={onTranscript} onInterimTranscript={onInterim} />,
    )
    await user.click(screen.getByRole('button'))

    act(() =>
      MockSpeechRecognition.last!.emitResult([
        { transcript: 'interim words', isFinal: false },
      ]),
    )
    expect(onInterim).toHaveBeenCalledWith('interim words')
    expect(onTranscript).not.toHaveBeenCalled()

    act(() =>
      MockSpeechRecognition.last!.emitResult([
        { transcript: 'final words', isFinal: true },
      ]),
    )
    expect(onTranscript).toHaveBeenCalledWith('final words')
  })

  it('can start a fresh session after a permission error', async () => {
    const user = userEvent.setup()
    render(<VoiceInput onTranscript={vi.fn()} />)

    await user.click(screen.getByRole('button'))
    const first = MockSpeechRecognition.last!
    act(() => first.emitError('not-allowed'))

    // The error cleared the session ref, so a new click starts a new session
    // (rather than being permanently blocked by the stale ref).
    await user.click(screen.getByRole('button', { name: 'Start voice input' }))
    const second = MockSpeechRecognition.last!
    expect(second).not.toBe(first)
    expect(second.start).toHaveBeenCalledOnce()
  })

  it('tears down the session on unmount', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<VoiceInput onTranscript={vi.fn()} />)
    await user.click(screen.getByRole('button'))
    const instance = MockSpeechRecognition.last!

    unmount()
    expect(instance.abort).toHaveBeenCalled()
  })

  it('surfaces a permission notice and calls onError when denied', async () => {
    const onError = vi.fn()
    const user = userEvent.setup()
    render(<VoiceInput onTranscript={vi.fn()} onError={onError} />)
    await user.click(screen.getByRole('button'))

    act(() => MockSpeechRecognition.last!.emitError('not-allowed'))

    expect(onError).toHaveBeenCalledWith('not-allowed')
    expect(screen.getByRole('status')).toHaveTextContent(/microphone access/i)
    // Recording state is cleared on error.
    expect(
      screen.getByRole('button', { name: 'Start voice input' }),
    ).toHaveAttribute('aria-pressed', 'false')
  })
})
