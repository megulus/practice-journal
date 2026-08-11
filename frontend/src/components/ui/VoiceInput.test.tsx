import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from '@testing-library/react'
import { render, screen, userEvent } from '@/test/utils'
import {
  MockSpeechRecognition,
  installSpeechMock,
  uninstallSpeechMock,
} from '@/test/speechMock'
import { VoiceInput, appendTranscript } from './VoiceInput'
import { stripPreview } from './useDictation'

beforeEach(installSpeechMock)
afterEach(uninstallSpeechMock)

describe('VoiceInput', () => {
  it('renders nothing when the Web Speech API is unavailable', () => {
    uninstallSpeechMock()
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

  it('keeps a stable accessible name when one is supplied', async () => {
    const user = userEvent.setup()
    render(<VoiceInput onTranscript={vi.fn()} aria-label="Dictate notes" />)

    const button = screen.getByRole('button', { name: 'Dictate notes' })
    expect(button).toHaveAttribute('aria-pressed', 'false')

    // Recording state rides on aria-pressed, not on a renamed button.
    await user.click(button)
    expect(
      screen.getByRole('button', { name: 'Dictate notes' }),
    ).toHaveAttribute('aria-pressed', 'true')
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

describe('stripPreview', () => {
  // `displayed` is committed + overlay; committedLength marks the boundary.
  it('drops the overlay when the edit lands before it', () => {
    // "bar 12" committed, " still rushing" overlay; user fixes 12 -> 14.
    expect(
      stripPreview('bar 12 still rushing', 'bar 14 still rushing', 6),
    ).toBe('bar 14')
  })

  it('drops the overlay when the user appends past it', () => {
    expect(stripPreview('hello world', 'hello world there', 5)).toBe(
      'hello there',
    )
  })

  it('keeps a deletion that only touches committed text', () => {
    expect(stripPreview('hello world', 'ello world', 5)).toBe('ello')
  })

  it('handles the field being cleared outright', () => {
    expect(stripPreview('hello world', '', 5)).toBe('')
  })

  it('reconstructs the edit exactly when there is no overlay', () => {
    // committedLength === displayed.length — safe to run on every change.
    expect(stripPreview('hello', 'hello!', 5)).toBe('hello!')
    expect(stripPreview('hello', 'hallo', 5)).toBe('hallo')
    expect(stripPreview('hello', 'ello', 5)).toBe('ello')
  })
})

describe('appendTranscript', () => {
  it('uses the chunk verbatim when the field is empty', () => {
    expect(appendTranscript('', '  long tones  ')).toBe('long tones')
  })

  it('separates the chunk from existing text with a single space', () => {
    expect(appendTranscript('slow practice', 'then faster')).toBe(
      'slow practice then faster',
    )
  })

  it('does not double up on trailing whitespace', () => {
    expect(appendTranscript('slow practice ', 'then faster')).toBe(
      'slow practice then faster',
    )
    expect(appendTranscript('first line\n', 'second')).toBe('first line\nsecond')
  })

  it('leaves the field untouched for an empty chunk', () => {
    expect(appendTranscript('unchanged', '   ')).toBe('unchanged')
  })
})
