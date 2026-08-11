import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, userEvent, waitFor, within } from '@/test/utils'
import TemplateEditorPage from './page'
import type { Instrument, Template } from '@/lib/types'

// One hoisted api object, returned by every `useApi()` call. A fresh object
// per render re-triggers the `api`-dependent load effect forever (#277).
const mocks = vi.hoisted(() => ({
  getTemplate: vi.fn(),
  listInstruments: vi.fn(),
  updateTemplate: vi.fn().mockResolvedValue(undefined),
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

/** Open an overflow menu and pick an item from it. */
async function chooseFromMenu(
  user: ReturnType<typeof userEvent.setup>,
  triggerName: string,
  itemName: string,
) {
  await user.click(screen.getByRole('button', { name: triggerName }))
  await user.click(await screen.findByRole('menuitem', { name: itemName }))
}

describe('TemplateEditorPage — destructive confirmations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getTemplate.mockResolvedValue(template)
    mocks.listInstruments.mockResolvedValue([instrument])
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

  it('re-activating an archived plan takes nothing away, so it skips the confirm', async () => {
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
