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
    expect(dialog).toHaveTextContent('Its 1 block go')

    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(mocks.deleteSection).toHaveBeenCalledWith(100))
  })

  it('confirms a session delete and names the sections that go with it', async () => {
    const user = userEvent.setup()
    await renderEditor()

    await user.click(screen.getByRole('button', { name: 'Delete session' }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Delete “Session 1”?')
    expect(dialog).toHaveTextContent('Its 1 section')

    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    await waitFor(() =>
      expect(mocks.deleteTemplateSession).toHaveBeenCalledWith(10),
    )
  })

  it('confirms a plan delete and names the sessions that go with it', async () => {
    const user = userEvent.setup()
    await renderEditor()

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Delete “Morning routine”?')
    expect(dialog).toHaveTextContent('This deletes the plan “Morning routine”.')
    expect(dialog).toHaveTextContent('Its 2 sessions')

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
