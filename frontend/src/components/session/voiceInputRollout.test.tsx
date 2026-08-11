import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent } from '@testing-library/react'
import { render, screen, userEvent } from '@/test/utils'
import {
  installSpeechMock,
  uninstallSpeechMock,
  dictate,
  dictateInterim,
  MockSpeechRecognition,
} from '@/test/speechMock'
import { SessionNotes } from './SessionNotes'
import { BlockRow } from './BlockRow'
import { QuickAddBlock } from './QuickAddBlock'
import { AddSectionButton } from './AddSectionButton'
import { SectionCard } from './SectionCard'
import RepertoireBlock from '../RepertoireBlock'
import { getSectionColor } from '@/lib/section-colors'
import type { BlockLog, SectionLog } from '@/lib/types'

// Hoist ONE stable api object: a fresh mock per render gives `api` a new
// identity every pass, which re-fires api-dependent effects forever (#277).
const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    updatePractice: vi.fn(),
    updateBlockLog: vi.fn(),
    updateSectionLog: vi.fn(),
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
    tempo_bpm: null,
    last_tempo_bpm: null,
    ...overrides,
  }
}

function makeFlushRef() {
  return { current: new Set<() => Promise<void>>() }
}

function makeSection(overrides: Partial<SectionLog> = {}): SectionLog {
  return {
    id: 9,
    section_id: null,
    section_type: 'scales',
    section_name: 'Scales',
    planned_duration_minutes: 10,
    actual_duration_minutes: 10,
    display_order: 0,
    completed: false,
    skipped: false,
    block_logs: [],
    ...overrides,
  }
}

/**
 * Tap a mic button and speak a finalized phrase into it. The async `act`
 * flushes the save that a commit kicks off, so its state updates land inside
 * the act scope rather than warning afterwards.
 */
async function speakInto(
  user: ReturnType<typeof userEvent.setup>,
  micLabel: string | RegExp,
  phrase: string,
) {
  await user.click(screen.getByRole('button', { name: micLabel }))
  await act(async () => {
    dictate(phrase)
  })
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
    render(
      <QuickAddBlock
        logId={1}
        sectionLogId={2}
        sectionName="Scales"
        instrument={null}
        onAdd={onAdd}
      />,
    )

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
        <QuickAddBlock
          logId={1}
          sectionLogId={2}
          sectionName="Scales"
          instrument={null}
          onAdd={vi.fn()}
        />
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

  it('shows the denied notice outside the section card that would clip it', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <SectionCard
        logId={1}
        sectionLog={makeSection()}
        color={getSectionColor('scales', 0)}
        instrument={null}
        suggestions={{}}
        onUpdate={vi.fn()}
        pendingFlushes={makeFlushRef()}
        repertoireBlockIds={{ current: new Set<number>() }}
      />,
    )

    // The quick-add form is the last child of a Card with `overflow-hidden`,
    // and the mic sits ~8px above the card's edge — an absolutely-positioned
    // notice rendered below it would be clipped away entirely.
    const clipper = container.querySelector('.overflow-hidden')
    expect(clipper).not.toBeNull()

    await user.click(screen.getByRole('button', { name: 'Dictate exercise name' }))
    act(() => MockSpeechRecognition.last!.emitError('not-allowed'))

    const notice = screen.getByRole('status')
    expect(notice).toHaveTextContent(/microphone access/i)
    expect(clipper).not.toContainElement(notice)
    expect(document.body).toContainElement(notice)
  })
})

// ---------------------------------------------------------------------------
// Dictated text has to persist on the same terms as typed text
// ---------------------------------------------------------------------------

describe('dictation persistence', () => {
  it('saves a dictated block note without waiting for a blur', async () => {
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
    await user.type(screen.getByPlaceholderText('Notes...'), 'bar 12')

    // Clicking the mic blurs the textarea, so the blur-save fires with the
    // PRE-dictation value and no further blur follows (focus stays on the
    // mic). The dictated text must be persisted on commit instead.
    await speakInto(user, 'Dictate notes for Scales', 'still rushing')

    expect(mockApi.updateBlockLog).toHaveBeenLastCalledWith(1, 7, {
      notes: 'bar 12 still rushing',
    })
  })

  it('saves dictated session notes without waiting for a blur', async () => {
    const user = userEvent.setup()
    render(
      <SessionNotes logId={3} initialNotes="" pendingFlushes={makeFlushRef()} />,
    )

    await speakInto(user, 'Dictate session notes', 'good session')

    expect(mockApi.updatePractice).toHaveBeenLastCalledWith(3, {
      notes: 'good session',
    })
  })

  it('saves a dictated spot note without waiting for a blur', async () => {
    const user = userEvent.setup()
    render(
      <RepertoireBlock
        logId={1}
        blockId={5}
        pieceName="Chaconne"
        spotLogs={[
          makeLog({
            id: 11,
            block_id: 5,
            spot_id: 9,
            block_name: 'Chaconne — bar 32',
          }),
        ]}
        pieceLog={null}
        onUpdate={vi.fn()}
        pendingFlushes={makeFlushRef()}
      />,
    )

    await user.click(screen.getByRole('button', { name: '+ add note' }))
    await speakInto(user, 'Dictate notes for bar 32', 'cleaner crossings')

    expect(mockApi.updateBlockLog).toHaveBeenLastCalledWith(1, 11, {
      notes: 'cleaner crossings',
    })
  })

  it('saves a dictated whole-piece note without waiting for a blur', async () => {
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
    await speakInto(user, 'Dictate notes for this piece', 'played it twice')

    expect(mockApi.updateBlockLog).toHaveBeenLastCalledWith(1, 20, {
      notes: 'played it twice',
    })
  })
})

// ---------------------------------------------------------------------------
// Only one mic may be live across the whole app
// ---------------------------------------------------------------------------

describe('mic arbitration across fields', () => {
  it('stops the first field when a second mic starts', async () => {
    const user = userEvent.setup()
    render(
      <>
        <SessionNotes logId={3} initialNotes="" pendingFlushes={makeFlushRef()} />
        <QuickAddBlock
          logId={1}
          sectionLogId={2}
          sectionName="Scales"
          instrument={null}
          onAdd={vi.fn()}
        />
      </>,
    )

    const notesMic = screen.getByRole('button', { name: 'Dictate session notes' })
    await user.click(notesMic)
    const firstSession = MockSpeechRecognition.last!
    expect(notesMic).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Dictate exercise name' }))

    // The first session is torn down, not left running in the background
    // appending into the earlier field.
    expect(firstSession.stop).toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: 'Dictate session notes' }),
    ).toHaveAttribute('aria-pressed', 'false')
    expect(
      screen.getByRole('button', { name: 'Dictate exercise name' }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('routes speech to the newest mic only', async () => {
    const user = userEvent.setup()
    render(
      <>
        <SessionNotes logId={3} initialNotes="" pendingFlushes={makeFlushRef()} />
        <QuickAddBlock
          logId={1}
          sectionLogId={2}
          sectionName="Scales"
          instrument={null}
          onAdd={vi.fn()}
        />
      </>,
    )

    await user.click(screen.getByRole('button', { name: 'Dictate session notes' }))
    await user.click(screen.getByRole('button', { name: 'Dictate exercise name' }))
    act(() => dictate('long tones'))

    expect(screen.getByPlaceholderText('Add an exercise…')).toHaveValue(
      'long tones',
    )
    expect(screen.getByPlaceholderText(/^Notes —/)).toHaveValue('')
  })
})

// ---------------------------------------------------------------------------
// Interim results stream into the field (design-tokens §6)
// ---------------------------------------------------------------------------

describe('interim transcription', () => {
  it('streams interim text and replaces it when the chunk finalizes', async () => {
    const user = userEvent.setup()
    render(
      <SessionNotes logId={3} initialNotes="" pendingFlushes={makeFlushRef()} />,
    )
    const field = screen.getByPlaceholderText(/^Notes —/)

    await user.click(screen.getByRole('button', { name: 'Dictate session notes' }))

    act(() => dictateInterim('the octaves'))
    expect(field).toHaveValue('the octaves')

    act(() => dictateInterim('the octaves finally'))
    expect(field).toHaveValue('the octaves finally')

    // Finalizing REPLACES the preview rather than appending it a second time.
    await act(async () => {
      dictate('the octaves finally locked in')
    })
    expect(field).toHaveValue('the octaves finally locked in')
  })

  it('keeps every word when a final extends its own preview', async () => {
    const user = userEvent.setup()
    render(
      <SessionNotes logId={3} initialNotes="" pendingFlushes={makeFlushRef()} />,
    )
    const field = screen.getByPlaceholderText(/^Notes —/)

    await user.click(screen.getByRole('button', { name: 'Dictate session notes' }))
    act(() => dictateInterim('slow practice'))

    // The preview never merged, so the longer final lands whole — the words
    // it added beyond the preview are not lost.
    await act(async () => {
      dictate('slow practice today with the metronome')
    })
    expect(field).toHaveValue('slow practice today with the metronome')
  })

  it('only persists finalized text, never the interim preview', async () => {
    const user = userEvent.setup()
    render(
      <SessionNotes logId={3} initialNotes="" pendingFlushes={makeFlushRef()} />,
    )

    await user.click(screen.getByRole('button', { name: 'Dictate session notes' }))
    act(() => dictateInterim('half a thought'))
    expect(mockApi.updatePractice).not.toHaveBeenCalled()

    await act(async () => {
      dictate('a whole thought')
    })
    expect(mockApi.updatePractice).toHaveBeenLastCalledWith(3, {
      notes: 'a whole thought',
    })
  })

  it('drops only the preview when the user edits the committed text under it', async () => {
    const user = userEvent.setup()
    render(
      <SessionNotes logId={3} initialNotes="" pendingFlushes={makeFlushRef()} />,
    )
    const field = screen.getByPlaceholderText(/^Notes —/)

    await user.click(screen.getByRole('button', { name: 'Dictate session notes' }))
    await act(async () => {
      dictate('bar 12')
    })
    act(() => dictateInterim('still rushing'))
    expect(field).toHaveValue('bar 12 still rushing')

    // The user corrects the committed part while the preview is live.
    fireEvent.change(field, { target: { value: 'bar 14 still rushing' } })

    // Their edit survives; the ephemeral preview does not.
    expect(field).toHaveValue('bar 14')

    // And the final still lands in full — nothing was swallowed.
    await act(async () => {
      dictate('still rushing')
    })
    expect(field).toHaveValue('bar 14 still rushing')
  })

  it('does not let an edit mid-preview swallow a later, separate dictation', async () => {
    const user = userEvent.setup()
    render(
      <SessionNotes logId={3} initialNotes="" pendingFlushes={makeFlushRef()} />,
    )
    const field = screen.getByPlaceholderText(/^Notes —/)

    // Session 1: the user edits over a live preview, which then never
    // finalizes — the engine gives up instead.
    await user.click(screen.getByRole('button', { name: 'Dictate session notes' }))
    await act(async () => {
      dictate('warm up')
    })
    act(() => dictateInterim('slow practice'))
    fireEvent.change(field, { target: { value: 'warm ups slow practice' } })
    expect(field).toHaveValue('warm ups')
    act(() => MockSpeechRecognition.last!.emitError('no-speech'))

    // Session 2, later: its first finalized chunk belongs to a different
    // utterance and must not be discarded on account of that earlier edit.
    await user.click(screen.getByRole('button', { name: 'Dictate session notes' }))
    await act(async () => {
      dictate('completely different words')
    })

    expect(field).toHaveValue('warm ups completely different words')
  })

  it('clears a stranded preview when recognition ends without finalizing', async () => {
    const user = userEvent.setup()
    render(
      <SessionNotes logId={3} initialNotes="" pendingFlushes={makeFlushRef()} />,
    )
    const field = screen.getByPlaceholderText(/^Notes —/)

    await user.click(screen.getByRole('button', { name: 'Dictate session notes' }))
    await act(async () => {
      dictate('the committed part')
    })
    act(() => dictateInterim('a trailing preview'))
    expect(field).toHaveValue('the committed part a trailing preview')

    // The engine drops the session without finalizing. The preview is
    // unconfirmed text that no persistence path would have written, so it
    // must not be left stranded in the field.
    act(() => MockSpeechRecognition.last!.emitError('network'))

    expect(field).toHaveValue('the committed part')
    expect(mockApi.updatePractice).toHaveBeenLastCalledWith(3, {
      notes: 'the committed part',
    })
  })
})

// ---------------------------------------------------------------------------
// Unmounting mid-recording
// ---------------------------------------------------------------------------

describe('unmount while recording', () => {
  it('aborts the session when the add-spot form closes on submit', async () => {
    const user = userEvent.setup()
    render(
      <RepertoireBlock
        logId={1}
        blockId={5}
        pieceName="Chaconne"
        spotLogs={[
          makeLog({
            id: 11,
            block_id: 5,
            spot_id: 9,
            block_name: 'Chaconne — bar 32',
          }),
        ]}
        pieceLog={null}
        onUpdate={vi.fn()}
        pendingFlushes={makeFlushRef()}
      />,
    )

    await user.click(screen.getByRole('button', { name: '+ Add spot' }))
    await speakInto(user, 'Dictate spot name', 'bar 48 shift')
    const session = MockSpeechRecognition.last!

    // Submitting closes the form, unmounting the mic mid-recording.
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(mockApi.addSpotMidSession).toHaveBeenCalledOnce()
    expect(screen.queryByPlaceholderText('Add a spot...')).toBeNull()
    expect(session.abort).toHaveBeenCalled()
  })

  it('frees the app-wide mic slot when a recording field unmounts', async () => {
    const user = userEvent.setup()
    const { unmount } = render(
      <SessionNotes logId={3} initialNotes="" pendingFlushes={makeFlushRef()} />,
    )
    await user.click(screen.getByRole('button', { name: 'Dictate session notes' }))
    unmount()

    // A later mic must still be able to claim the slot.
    render(<QuickAddBlock
          logId={1}
          sectionLogId={2}
          sectionName="Scales"
          instrument={null}
          onAdd={vi.fn()}
        />)
    await user.click(screen.getByRole('button', { name: 'Dictate exercise name' }))
    act(() => dictate('long tones'))

    expect(screen.getByPlaceholderText('Add an exercise…')).toHaveValue(
      'long tones',
    )
  })
})
