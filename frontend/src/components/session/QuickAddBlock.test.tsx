import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, userEvent, waitFor } from '@/test/utils'
import { QuickAddBlock } from './QuickAddBlock'
import type { Instrument } from '@/lib/types'
import { installSpeechMock, uninstallSpeechMock } from '@/test/speechMock'

// One stable object: AddBlockSheet loads the library in an `api`-dependent
// effect, and a fresh mock per render would loop it forever (#277).
const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    addFreeformBlock: vi.fn().mockResolvedValue(undefined),
    browseCuratedBlocks: vi.fn().mockResolvedValue([]),
    listRecentBlocks: vi.fn().mockResolvedValue([]),
    listRepertoirePieces: vi.fn().mockResolvedValue({ pieces: [] }),
  },
}))

vi.mock('@/lib/useApi', () => ({ useApi: () => mockApi }))

const instrument: Instrument = {
  id: 4,
  name: 'Violin',
  instrument_category: 'violin',
  practice_frequency: 'daily',
  display_order: 0,
  active_template_count: 1,
  // Every live template, archived included (#282); never below the active count.
  template_count: 1,
  piece_count: 0,
  last_practiced_at: null,
}

function resetApi() {
  mockApi.addFreeformBlock.mockClear().mockResolvedValue(undefined)
  mockApi.browseCuratedBlocks.mockClear().mockResolvedValue([])
  mockApi.listRecentBlocks.mockClear().mockResolvedValue([])
  mockApi.listRepertoirePieces.mockClear().mockResolvedValue({ pieces: [] })
}

describe('QuickAddBlock', () => {
  beforeEach(resetApi)

  it('adds a trimmed block and clears the input on submit', async () => {
    const onAdd = vi.fn()
    const user = userEvent.setup()
    render(
      <QuickAddBlock
        logId={1}
        sectionLogId={2}
        sectionName="Scales"
        instrument={instrument}
        onAdd={onAdd}
      />
    )

    const input = screen.getByPlaceholderText('Add an exercise…')
    await user.type(input, '  Long tones  {Enter}')

    expect(mockApi.addFreeformBlock).toHaveBeenCalledExactlyOnceWith(1, 2, {
      block_name: 'Long tones',
    })
    expect(onAdd).toHaveBeenCalledOnce()
    expect(input).toHaveValue('')
  })

  it('does nothing when the input is empty', async () => {
    const onAdd = vi.fn()
    const user = userEvent.setup()
    render(
      <QuickAddBlock
        logId={1}
        sectionLogId={2}
        sectionName="Scales"
        instrument={instrument}
        onAdd={onAdd}
      />
    )

    const input = screen.getByPlaceholderText('Add an exercise…')
    await user.type(input, '   {Enter}')

    expect(mockApi.addFreeformBlock).not.toHaveBeenCalled()
    expect(onAdd).not.toHaveBeenCalled()
  })
})

describe('QuickAddBlock — Browse library (#182)', () => {
  beforeEach(resetApi)

  it('opens the block library sheet scoped to the section', async () => {
    const user = userEvent.setup()
    render(
      <QuickAddBlock
        logId={1}
        sectionLogId={2}
        sectionName="Scales"
        instrument={instrument}
        onAdd={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Browse library' }))

    expect(await screen.findByText('Add to: Scales')).toBeInTheDocument()
    await waitFor(() =>
      expect(mockApi.browseCuratedBlocks).toHaveBeenCalledWith({
        instrument: 'violin',
        q: undefined,
      })
    )
  })

  it('adds a picked library block as a freeform block log', async () => {
    mockApi.browseCuratedBlocks.mockResolvedValue([
      {
        id: 11,
        name: 'Sevcik op. 1',
        description: 'Finger patterns',
        section_type: 'technique',
        default_duration_minutes: 5,
        usage_count: 3,
        usage_percentage: 40,
      },
    ])
    const onAdd = vi.fn()
    const user = userEvent.setup()
    render(
      <QuickAddBlock
        logId={1}
        sectionLogId={2}
        sectionName="Scales"
        instrument={instrument}
        onAdd={onAdd}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Browse library' }))
    await user.click(await screen.findByText('Sevcik op. 1'))

    await waitFor(() =>
      expect(mockApi.addFreeformBlock).toHaveBeenCalledExactlyOnceWith(1, 2, {
        block_name: 'Sevcik op. 1',
      })
    )
    expect(onAdd).toHaveBeenCalledOnce()
    // The sheet closes itself once the block lands
    await waitFor(() =>
      expect(screen.queryByText('Add to: Scales')).not.toBeInTheDocument()
    )
  })

  it('closes the sheet with no changes on cancel', async () => {
    const user = userEvent.setup()
    render(
      <QuickAddBlock
        logId={1}
        sectionLogId={2}
        sectionName="Scales"
        instrument={instrument}
        onAdd={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Browse library' }))
    await screen.findByText('Add to: Scales')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(() =>
      expect(screen.queryByText('Add to: Scales')).not.toBeInTheDocument()
    )
    expect(mockApi.addFreeformBlock).not.toHaveBeenCalled()
  })

  it('keeps the mic and the library link as separate reachable controls', () => {
    // #281 put a submit button and a mic in this row; the library link joins
    // them. All four controls stay distinct, in reading order, in one row.
    // (The mic only renders where the Web Speech API exists — hence the mock;
    // without it the row is input + submit + link, which is also correct.)
    installSpeechMock()
    try {
      render(
        <QuickAddBlock
          logId={1}
          sectionLogId={2}
          sectionName="Scales"
          instrument={instrument}
          onAdd={vi.fn()}
        />
      )

      const row = screen
        .getByPlaceholderText('Add an exercise…')
        .closest('form')!
      const controls = Array.from(row.querySelectorAll('input, button')).map(
        (el) => el.getAttribute('aria-label') || el.textContent
      )

      expect(controls).toEqual([
        '', // the text input, labelled by its placeholder
        'Add exercise',
        'Dictate exercise name',
        'Browse library',
      ])
    } finally {
      uninstallSpeechMock()
    }
  })

  it('opening the library does not submit the typed name', async () => {
    // The link sits inside the quick-add <form>, so it must be type="button" —
    // otherwise browsing would also create a block from whatever was typed.
    const onAdd = vi.fn()
    const user = userEvent.setup()
    render(
      <QuickAddBlock
        logId={1}
        sectionLogId={2}
        sectionName="Scales"
        instrument={instrument}
        onAdd={onAdd}
      />
    )

    await user.type(
      screen.getByPlaceholderText('Add an exercise…'),
      'Half-finished thought'
    )
    await user.click(screen.getByRole('button', { name: 'Browse library' }))

    expect(await screen.findByText('Add to: Scales')).toBeInTheDocument()
    expect(mockApi.addFreeformBlock).not.toHaveBeenCalled()
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('scopes the sheet to standard blocks — no repertoire mid-session', async () => {
    const user = userEvent.setup()
    render(
      <QuickAddBlock
        logId={1}
        sectionLogId={2}
        sectionName="Scales"
        instrument={instrument}
        onAdd={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Browse library' }))
    await screen.findByText('Add to: Scales')

    // Repertoire mid-session is RepertoireBlock's "Add a spot" flow (#182),
    // and the practice-log endpoint can't attach a piece to a block log —
    // so the tab that returns `{ piece_id }` isn't offered here at all.
    expect(screen.getByRole('button', { name: 'Curated' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Recent' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Your rep.' })).toBeNull()
    expect(mockApi.listRepertoirePieces).not.toHaveBeenCalled()
  })

  it('hides the link until the session instrument is known', () => {
    render(
      <QuickAddBlock
        logId={1}
        sectionLogId={2}
        sectionName="Scales"
        instrument={null}
        onAdd={vi.fn()}
      />
    )
    expect(
      screen.queryByRole('button', { name: 'Browse library' })
    ).not.toBeInTheDocument()
  })
})
