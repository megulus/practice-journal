import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from '@testing-library/react'
import { render, screen, userEvent, waitFor, within } from '@/test/utils'
import TemplateEditorPage from './page'
import type {
  Instrument,
  Template,
  TemplateUpdateResult,
} from '@/lib/types'

// One hoisted api object, returned by every `useApi()` call. A fresh object
// per render re-triggers the `api`-dependent load effect forever (#277).
const mocks = vi.hoisted(() => ({
  getTemplate: vi.fn(),
  listInstruments: vi.fn(),
  updateTemplate: vi.fn(),
  deleteTemplate: vi.fn().mockResolvedValue(undefined),
  deleteTemplateSession: vi.fn().mockResolvedValue(undefined),
  deleteSection: vi.fn().mockResolvedValue(undefined),
  deleteBlock: vi.fn().mockResolvedValue(undefined),
  push: vi.fn(),
}))

vi.mock('@/lib/useApi', () => {
  const api = {
    getTemplate: mocks.getTemplate,
    listInstruments: mocks.listInstruments,
    updateTemplate: mocks.updateTemplate,
    deleteTemplate: mocks.deleteTemplate,
    deleteTemplateSession: mocks.deleteTemplateSession,
    deleteSection: mocks.deleteSection,
    deleteBlock: mocks.deleteBlock,
  }
  return { useApi: () => api }
})

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '1' }),
  useRouter: () => ({ push: mocks.push, replace: vi.fn() }),
}))

const instrument: Instrument = {
  id: 1,
  name: 'Violin',
  instrument_category: 'violin',
  practice_frequency: 'daily',
  display_order: 0,
  active_template_count: 1,
  template_count: 1,
  piece_count: 0,
  last_practiced_at: null,
}

const template: Template = {
  id: 1,
  instrument_id: 1,
  name: 'Morning routine',
  description: null,
  is_active: true,
  current_rotation_index: 0,
  sessions: [
    {
      id: 10,
      name: 'Session 1',
      focus_description: null,
      display_order: 0,
      estimated_duration_minutes: 20,
      sections: [
        {
          id: 100,
          name: 'Warm-up',
          section_type: 'warmup',
          estimated_duration_minutes: 10,
          display_order: 0,
          blocks: [
            {
              id: 1000,
              name: 'Scales',
              description: null,
              estimated_duration_minutes: 5,
              tempo_bpm: null,
              key: null,
              difficulty_level: null,
              display_order: 0,
              curated_block_id: null,
              piece_id: null,
              piece_name: null,
              default_spots: null,
            },
          ],
        },
      ],
    },
    {
      id: 11,
      name: 'Session 2',
      focus_description: null,
      display_order: 1,
      estimated_duration_minutes: 20,
      sections: [],
    },
  ],
}

/**
 * The same plan with a repertoire block (piece_id set, two default spots)
 * alongside the standard one — #283's editor surface.
 */
function withRepertoireBlock(defaultSpotCount: number): Template {
  const [session] = template.sessions
  const [section] = session.sections
  return {
    ...template,
    sessions: [
      {
        ...session,
        sections: [
          {
            ...section,
            blocks: [
              ...section.blocks,
              {
                id: 2000,
                name: null,
                description: null,
                estimated_duration_minutes: 10,
                tempo_bpm: null,
                key: null,
                difficulty_level: null,
                display_order: 1,
                curated_block_id: null,
                piece_id: 7,
                piece_name: 'Bach Partita',
                default_spots: Array.from(
                  { length: defaultSpotCount },
                  (_, i) => ({
                    id: 3000 + i,
                    name: `Spot ${i + 1}`,
                    location: null,
                    display_order: i,
                  }),
                ),
              },
            ],
          },
        ],
      },
      ...template.sessions.slice(1),
    ],
  }
}

/** Open an overflow menu and pick an item from it. */
async function chooseFromMenu(
  user: ReturnType<typeof userEvent.setup>,
  triggerName: string,
  itemName: string,
) {
  await user.click(screen.getByRole('button', { name: triggerName }))
  await user.click(await screen.findByRole('menuitem', { name: itemName }))
}

/**
 * A PATCH /api/templates/{id} response. `deactivated_template_name` is the
 * plan this write displaced, or null when it displaced nothing (#289).
 */
function updateResult(
  patch: Partial<TemplateUpdateResult> = {},
): TemplateUpdateResult {
  return { ...template, deactivated_template_name: null, ...patch }
}

describe('TemplateEditorPage — destructive confirmations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getTemplate.mockResolvedValue(template)
    mocks.listInstruments.mockResolvedValue([instrument])
    mocks.updateTemplate.mockResolvedValue(updateResult())
  })

  async function renderEditor() {
    render(<TemplateEditorPage />)
    await screen.findByDisplayValue('Morning routine')
  }

  it('confirms a block delete, naming the block', async () => {
    const user = userEvent.setup()
    await renderEditor()

    await chooseFromMenu(user, 'Block actions', 'Delete')

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Delete “Scales”?')
    expect(dialog).toHaveTextContent('This deletes the block “Scales”.')
    expect(mocks.deleteBlock).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(mocks.deleteBlock).toHaveBeenCalledWith(1000))
  })

  // A repertoire block is the piece's slot in this plan, not the piece.
  // delete_block hard-deletes the block row and its default-spot links; the
  // Piece and Spot rows are untouched, so the copy has to say which one goes.
  it('confirms a repertoire block delete without implying the piece goes', async () => {
    const user = userEvent.setup()
    mocks.getTemplate.mockResolvedValue(withRepertoireBlock(2))
    await renderEditor()

    await chooseFromMenu(user, 'Bach Partita actions', 'Delete')

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Delete “Bach Partita”?')
    expect(dialog).toHaveTextContent(
      'This deletes the repertoire block “Bach Partita”.',
    )
    expect(dialog).toHaveTextContent(
      'Deleting it also removes its 2 default spots.',
    )
    expect(dialog).toHaveTextContent(
      'The piece and its spots stay in your repertoire.',
    )

    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(mocks.deleteBlock).toHaveBeenCalledWith(2000))
  })

  it('omits the spot cascade for a repertoire block with no defaults', async () => {
    const user = userEvent.setup()
    mocks.getTemplate.mockResolvedValue(withRepertoireBlock(0))
    await renderEditor()

    await chooseFromMenu(user, 'Bach Partita actions', 'Delete')

    const dialog = await screen.findByRole('dialog')
    expect(dialog).not.toHaveTextContent('0 default spot')
    // The reassurance holds whether or not there were defaults.
    expect(dialog).toHaveTextContent(
      'The piece and its spots stay in your repertoire.',
    )
  })

  it('leaves the block alone when the confirm is cancelled', async () => {
    const user = userEvent.setup()
    await renderEditor()

    await chooseFromMenu(user, 'Block actions', 'Delete')
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    expect(mocks.deleteBlock).not.toHaveBeenCalled()
  })

  it('leaves the block alone when the confirm is escaped', async () => {
    const user = userEvent.setup()
    await renderEditor()

    await chooseFromMenu(user, 'Block actions', 'Delete')
    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    expect(mocks.deleteBlock).not.toHaveBeenCalled()
  })

  it('confirms a section delete and names the blocks that go with it', async () => {
    const user = userEvent.setup()
    await renderEditor()

    await chooseFromMenu(user, 'Section actions', 'Delete')

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Delete “Warm-up”?')
    expect(dialog).toHaveTextContent('Deleting it also removes its 1 block.')

    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(mocks.deleteSection).toHaveBeenCalledWith(100))
  })

  it('confirms a session delete and names the sections that go with it', async () => {
    const user = userEvent.setup()
    await renderEditor()

    await user.click(screen.getByRole('button', { name: 'Delete session' }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Delete “Session 1”?')
    expect(dialog).toHaveTextContent(
      'Deleting it also removes its 1 section and everything in it.',
    )

    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    await waitFor(() =>
      expect(mocks.deleteTemplateSession).toHaveBeenCalledWith(10),
    )
  })

  // `alsoRemoves` agrees at any count, but "its 0 sections and everything in
  // them" is still nonsense to show — an empty session has no cascade to name.
  // Reachable: the page renders a "No sections yet." empty state, and session
  // delete stays available whenever the plan has more than one session.
  it('omits the cascade when deleting a session with no sections', async () => {
    const user = userEvent.setup()
    await renderEditor()

    // Session 2 in the fixture has no sections.
    await user.click(screen.getByRole('button', { name: 'Session 2' }))
    await screen.findByText('No sections yet.')
    await user.click(screen.getByRole('button', { name: 'Delete session' }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Delete “Session 2”?')
    expect(dialog).toHaveTextContent('This deletes the session “Session 2”.')
    expect(dialog).not.toHaveTextContent('0 section')
    expect(dialog).not.toHaveTextContent('everything in')

    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    await waitFor(() =>
      expect(mocks.deleteTemplateSession).toHaveBeenCalledWith(11),
    )
  })

  it('omits the rotation cascade when a plan has no sessions', async () => {
    const user = userEvent.setup()
    mocks.getTemplate.mockResolvedValue({ ...template, sessions: [] })
    await renderEditor()

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).not.toHaveTextContent('0 rotation session')
    expect(dialog).not.toHaveTextContent('everything in')
    // The reassurance holds regardless of session count.
    expect(dialog).toHaveTextContent('Your logged practice history is kept.')
  })

  it('confirms a plan delete and names the sessions that go with it', async () => {
    const user = userEvent.setup()
    await renderEditor()

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Delete “Morning routine”?')
    expect(dialog).toHaveTextContent('This deletes the plan “Morning routine”.')
    // "rotation sessions", not bare "sessions" — the word means both a
    // rotation day and a logged practice, and only the former goes.
    expect(dialog).toHaveTextContent(
      'Deleting it also removes its 2 rotation sessions and everything in them.',
    )
    expect(dialog).toHaveTextContent('Your logged practice history is kept.')

    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(mocks.deleteTemplate).toHaveBeenCalledWith(1))
    expect(mocks.push).toHaveBeenCalledWith('/plans')
  })

  it('confirms archiving an active plan', async () => {
    const user = userEvent.setup()
    await renderEditor()

    await user.click(screen.getByRole('button', { name: 'Active plan' }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Archive “Morning routine”?')
    expect(mocks.updateTemplate).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: 'Archive' }))
    await waitFor(() =>
      expect(mocks.updateTemplate).toHaveBeenCalledWith(1, { is_active: false }),
    )
  })

  // Activating *does* take something away — the instrument's previous active
  // plan — but reversibly, so the effect is reported afterwards rather than
  // gated behind a dialog (#289). The notice tests live in the block below.
  it('activating an archived plan skips the confirm', async () => {
    const user = userEvent.setup()
    mocks.getTemplate.mockResolvedValue({ ...template, is_active: false })
    await renderEditor()

    await user.click(screen.getByRole('button', { name: 'Set as active' }))

    await waitFor(() =>
      expect(mocks.updateTemplate).toHaveBeenCalledWith(1, { is_active: true }),
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

/**
 * #289: "Set as active" deactivates the instrument's current active plan, which
 * is a change to a plan that isn't on screen. No confirm — it only flips
 * `is_active` — but the editor has to say what it did, and name it.
 */
describe('TemplateEditorPage — activation notice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getTemplate.mockResolvedValue({ ...template, is_active: false })
    mocks.listInstruments.mockResolvedValue([instrument])
    mocks.updateTemplate.mockResolvedValue(updateResult())
  })

  async function renderInactiveEditor() {
    render(<TemplateEditorPage />)
    await screen.findByDisplayValue('Morning routine')
    return screen.getByRole('button', { name: 'Set as active' })
  }

  it('names the plan the activation displaced, in a live region', async () => {
    const user = userEvent.setup()
    mocks.updateTemplate.mockResolvedValue(
      updateResult({ is_active: true, deactivated_template_name: 'Daily warm-up' }),
    )
    const pill = await renderInactiveEditor()

    await user.click(pill)

    // A screen reader has to receive this, so it has to be the live region's
    // content — not just any text that appeared on screen.
    const live = screen.getByRole('status')
    await waitFor(() =>
      expect(live).toHaveTextContent(
        '“Daily warm-up” is no longer active — an instrument has one active plan at a time.',
      ),
    )
    expect(live).toHaveAttribute('aria-live', 'polite')
  })

  it('claims no displacement when the activation displaced nothing', async () => {
    const user = userEvent.setup()
    mocks.updateTemplate.mockResolvedValue(updateResult({ is_active: true }))
    const pill = await renderInactiveEditor()

    await user.click(pill)

    await waitFor(() =>
      expect(mocks.updateTemplate).toHaveBeenCalledWith(1, { is_active: true }),
    )
    // The plan went active; nothing was archived to report.
    await screen.findByRole('button', { name: 'Active plan' })
    expect(screen.getByRole('status')).toHaveTextContent('')
    expect(screen.queryByText(/no longer active/)).not.toBeInTheDocument()
  })

  it('reports a failed activation and leaves the pill unchanged', async () => {
    const user = userEvent.setup()
    mocks.updateTemplate.mockRejectedValue(new Error('network'))
    const pill = await renderInactiveEditor()

    await user.click(pill)

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        "Couldn't set this plan as active. Please try again.",
      ),
    )
    // The write didn't land, so the pill must not pretend it did.
    expect(screen.getByRole('button', { name: 'Set as active' })).toBeInTheDocument()
    expect(screen.queryByText(/no longer active/)).not.toBeInTheDocument()
  })

  it('dismisses the displacement notice on its own', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      mocks.updateTemplate.mockResolvedValue(
        updateResult({
          is_active: true,
          deactivated_template_name: 'Daily warm-up',
        }),
      )
      const pill = await renderInactiveEditor()

      await user.click(pill)
      await waitFor(() =>
        expect(screen.getByRole('status')).toHaveTextContent(/no longer active/),
      )

      await act(async () => {
        await vi.advanceTimersByTimeAsync(8000)
      })
      expect(screen.getByRole('status')).toHaveTextContent('')
    } finally {
      vi.useRealTimers()
    }
  })

  it('reports a failed archive too', async () => {
    const user = userEvent.setup()
    mocks.getTemplate.mockResolvedValue(template) // active
    mocks.updateTemplate.mockRejectedValue(new Error('network'))
    render(<TemplateEditorPage />)
    await screen.findByDisplayValue('Morning routine')

    await user.click(screen.getByRole('button', { name: 'Active plan' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Archive' }))

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        "Couldn't archive this plan. Please try again.",
      ),
    )
    expect(
      screen.getByRole('button', { name: 'Active plan' }),
    ).toBeInTheDocument()
  })
})
