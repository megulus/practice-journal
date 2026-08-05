import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from '@testing-library/react'
import { render, screen, userEvent } from '@/test/utils'
import {
  installSpeechMock,
  uninstallSpeechMock,
  dictate,
  MockSpeechRecognition,
} from '@/test/speechMock'
import { SessionNotes } from './SessionNotes'
import { BlockRow } from './BlockRow'
import { QuickAddBlock } from './QuickAddBlock'
import { AddSectionButton } from './AddSectionButton'
import RepertoireBlock from '../RepertoireBlock'
import type { BlockLog } from '@/lib/types'

// Hoist ONE stable api object: a fresh mock per render gives `api` a new
// identity every pass, which re-fires api-dependent effects forever (#277).
const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    updatePractice: vi.fn(),
    updateBlockLog: vi.fn(),
    addFreeformBlock: vi.fn(),
    addFreeformSection: vi.fn(),
    addSpotMidSession: vi.fn(),
  },
}))

vi.mock('@/lib/useApi', () => ({ useApi: () => mockApi }))

function makeLog(overrides: Partial<BlockLog> = {}): BlockLog {
  return {
    id: 7,
    block_id: null,
    spot_id: null,
    block_name: 'Scales',
    rating: null,
    notes: null,
    completed: false,
    display_order: 0,
    last_tempo_bpm: null,
    ...overrides,
  }
}

function makeFlushRef() {
  return { current: new Set<() => Promise<void>>() }
}

/** Tap a mic button and speak a finalized phrase into it. */
async function speakInto(
  user: ReturnType<typeof userEvent.setup>,
  micLabel: string | RegExp,
  phrase: string,
) {
  await user.click(screen.getByRole('button', { name: micLabel }))
  act(() => dictate(phrase))
}

beforeEach(() => {
  installSpeechMock()
  Object.values(mockApi).forEach((fn) => fn.mockReset().mockResolvedValue(undefined))
})

afterEach(uninstallSpeechMock)

// ---------------------------------------------------------------------------
// Active session — one mic per text field
// ---------------------------------------------------------------------------

describe('voice input in the active session', () => {
  it('dictates into the session notes and leaves them editable', async () => {
    const user = userEvent.setup()
    const flushRef = makeFlushRef()
    render(<SessionNotes logId={3} initialNotes="" pendingFlushes={flushRef} />)

    await speakInto(user, 'Dictate session notes', 'the octaves finally locked in')

    const field = screen.getByPlaceholderText(/^Notes —/)
    expect(field).toHaveValue('the octaves finally locked in')

    // Dictated text is covered by the same Finish-time flush as typed text.
    expect(flushRef.current.size).toBe(1)

    // …and stays editable afterward.
    await user.type(field, ' today')
    expect(field).toHaveValue('the octaves finally locked in today')
  })

  it('appends dictated text after what was already typed', async () => {
    const user = userEvent.setup()
    render(
      <SessionNotes logId={3} initialNotes="" pendingFlushes={makeFlushRef()} />,
    )

    await user.type(screen.getByPlaceholderText(/^Notes —/), 'left hand')
    await speakInto(user, 'Dictate session notes', 'felt relaxed')

    expect(screen.getByPlaceholderText(/^Notes —/)).toHaveValue(
      'left hand felt relaxed',
    )
  })

  it('dictates into a per-block note', async () => {
    const user = userEvent.setup()
    render(
      <BlockRow
        logId={1}
        blockLog={makeLog()}
        onUpdate={vi.fn()}
        pendingFlushes={makeFlushRef()}
      />,
    )

    await user.click(screen.getByRole('button', { name: '+ add note' }))
    await speakInto(user, 'Dictate notes for Scales', 'tricky shift at bar 12')

    expect(screen.getByPlaceholderText('Notes...')).toHaveValue(
      'tricky shift at bar 12',
    )
  })

  it('dictates a quick-add block name and submits it', async () => {
    const onAdd = vi.fn()
    const user = userEvent.setup()
    render(<QuickAddBlock logId={1} sectionLogId={2} onAdd={onAdd} />)

    await speakInto(user, 'Dictate exercise name', 'long tones')
    expect(screen.getByPlaceholderText('Add an exercise…')).toHaveValue(
      'long tones',
    )

    // Voice-only entry needs a tappable submit — there's no Enter key involved.
    await user.click(screen.getByRole('button', { name: 'Add exercise' }))
    expect(mockApi.addFreeformBlock).toHaveBeenCalledExactlyOnceWith(1, 2, {
      block_name: 'long tones',
    })
    expect(onAdd).toHaveBeenCalledOnce()
  })

  it('dictates a freeform section name and submits it', async () => {
    const onAdd = vi.fn()
    const user = userEvent.setup()
    render(<AddSectionButton logId={4} onAdd={onAdd} />)

    await user.click(screen.getByRole('button', { name: '+ Add a section' }))
    await speakInto(user, 'Dictate section name', 'sight reading')

    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(mockApi.addFreeformSection).toHaveBeenCalledExactlyOnceWith(4, {
      section_name: 'sight reading',
      section_type: 'other',
    })
    expect(onAdd).toHaveBeenCalledOnce()
  })
})

// ---------------------------------------------------------------------------
// Active session — repertoire blocks
// ---------------------------------------------------------------------------

describe('voice input in a repertoire block', () => {
  const spotLogs = [
    makeLog({ id: 11, block_id: 5, spot_id: 9, block_name: 'Chaconne — bar 32' }),
  ]

  function renderBlock() {
    return render(
      <RepertoireBlock
        logId={1}
        blockId={5}
        pieceName="Chaconne"
        spotLogs={spotLogs}
        pieceLog={null}
        onUpdate={vi.fn()}
        pendingFlushes={makeFlushRef()}
      />,
    )
  }

  it('dictates into a per-spot note', async () => {
    const user = userEvent.setup()
    renderBlock()

    await user.click(screen.getByRole('button', { name: '+ add note' }))
    await speakInto(user, 'Dictate notes for bar 32', 'string crossings cleaner')

    expect(screen.getByPlaceholderText('Notes...')).toHaveValue(
      'string crossings cleaner',
    )
  })

  it('dictates a new spot name and submits it', async () => {
    const user = userEvent.setup()
    renderBlock()

    await user.click(screen.getByRole('button', { name: '+ Add spot' }))
    await speakInto(user, 'Dictate spot name', 'bar 48 shift')

    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(mockApi.addSpotMidSession).toHaveBeenCalledExactlyOnceWith(1, 11, {
      name: 'bar 48 shift',
      add_to_rotation: true,
    })
  })

  it('dictates into the whole-piece note', async () => {
    const user = userEvent.setup()
    render(
      <RepertoireBlock
        logId={1}
        blockId={5}
        pieceName="Chaconne"
        spotLogs={[]}
        pieceLog={makeLog({ id: 20, block_id: 5, block_name: 'Chaconne' })}
        onUpdate={vi.fn()}
        pendingFlushes={makeFlushRef()}
      />,
    )

    await user.click(screen.getByRole('button', { name: '+ add note' }))
    await speakInto(user, 'Dictate notes for this piece', 'played it through twice')

    expect(screen.getByPlaceholderText('Notes...')).toHaveValue(
      'played it through twice',
    )
  })
})

// ---------------------------------------------------------------------------
// Graceful degradation
// ---------------------------------------------------------------------------

describe('voice input fallbacks', () => {
  it('renders no mic button at all when the Web Speech API is missing', () => {
    uninstallSpeechMock()
    render(
      <>
        <SessionNotes logId={3} initialNotes="" pendingFlushes={makeFlushRef()} />
        <QuickAddBlock logId={1} sectionLogId={2} onAdd={vi.fn()} />
      </>,
    )

    // Hidden entirely rather than disabled — a greyed-out mic just confuses.
    expect(screen.queryByRole('button', { name: /dictate/i })).toBeNull()
    // The fields themselves still work.
    expect(screen.getByPlaceholderText(/^Notes —/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Add an exercise…')).toBeInTheDocument()
  })

  it('shows a non-blocking notice when mic permission is denied, and the field stays usable', async () => {
    const user = userEvent.setup()
    render(
      <SessionNotes logId={3} initialNotes="" pendingFlushes={makeFlushRef()} />,
    )

    await user.click(screen.getByRole('button', { name: 'Dictate session notes' }))
    act(() => MockSpeechRecognition.last!.emitError('not-allowed'))

    expect(screen.getByRole('status')).toHaveTextContent(/microphone access/i)

    const field = screen.getByPlaceholderText(/^Notes —/)
    await user.type(field, 'typed instead')
    expect(field).toHaveValue('typed instead')
  })
})
