import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, userEvent, waitFor } from '@/test/utils'
import AppShell from '@/components/layout/AppShell'
import { QuickStartWizard } from './QuickStartWizard'
import type { Instrument, QuickStartRequest } from '@/lib/types'

// One stable client for the whole file — a fresh object per render would
// change `api`'s identity and spin any api-dependent effect (see #277).
const { mockApi, mockPush } = vi.hoisted(() => ({
  mockApi: { quickStart: vi.fn() },
  mockPush: vi.fn(),
}))

vi.mock('@/lib/useApi', () => ({ useApi: () => mockApi }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/today',
  useSearchParams: () => new URLSearchParams(),
}))

function makeInstrument(o: Partial<Instrument> = {}): Instrument {
  return {
    id: 1,
    name: 'Violin',
    instrument_category: 'violin',
    practice_frequency: 'daily',
    display_order: 0,
    active_template_count: 0,
    piece_count: 0,
    last_practiced_at: null,
    ...o,
  }
}

const CREATED = {
  instrument: makeInstrument({ id: 12 }),
  template: {
    id: 34,
    instrument_id: 12,
    name: 'Bruch Violin Concerto',
    description: null,
    is_active: true,
    current_rotation_index: 0,
    sessions: [],
  },
  template_session_id: 56,
  piece: null,
}

function renderWizard(props: Partial<Parameters<typeof QuickStartWizard>[0]> = {}) {
  const onSkip = vi.fn()
  const onSaved = vi.fn()
  const utils = render(
    <QuickStartWizard
      instruments={[]}
      onSkip={onSkip}
      onSaved={onSaved}
      {...props}
    />,
  )
  return { ...utils, onSkip, onSaved }
}

/** Walk the wizard to step 5 with the given answers. */
async function fillToPreview(
  user: ReturnType<typeof userEvent.setup>,
  { goal = 'Bruch Violin Concerto', piece = 'Bruch Violin Concerto' } = {},
) {
  await user.click(screen.getByRole('button', { name: 'Violin' }))
  await user.click(screen.getByRole('button', { name: 'Next' }))

  if (goal) {
    await user.type(
      screen.getByLabelText('What are you working on right now?'),
      goal,
    )
    await user.click(screen.getByRole('button', { name: 'Next' }))
  } else {
    await user.click(
      screen.getByRole('button', {
        name: /just get me started/,
      }),
    )
  }

  await user.click(screen.getByRole('button', { name: 'Next' })) // areas

  if (piece) {
    await user.type(screen.getByLabelText(/Piece you're working on/), piece)
    await user.click(screen.getByRole('button', { name: 'Next' }))
  } else {
    await user.click(screen.getByRole('button', { name: /Skip — I'll add later/ }))
  }
}

function lastRequest(): QuickStartRequest {
  return mockApi.quickStart.mock.calls.at(-1)![0]
}

beforeEach(() => {
  mockApi.quickStart.mockReset()
  mockApi.quickStart.mockResolvedValue(CREATED)
  mockPush.mockReset()
})

describe('QuickStartWizard — step flow', () => {
  it('opens on the instrument step', () => {
    renderWizard()
    expect(
      screen.getByRole('heading', { name: 'What do you play?' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Step 1 of 5')).toBeInTheDocument()
  })

  it('offers instruments the user already has alongside the presets', () => {
    renderWizard({
      instruments: [makeInstrument({ id: 4, name: 'Tenor recorder' })],
    })
    expect(
      screen.getByRole('button', { name: 'Tenor recorder' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Piano' })).toBeInTheDocument()
  })

  it('does not repeat a preset the user already owns', () => {
    renderWizard({ instruments: [makeInstrument({ id: 4, name: 'violin' })] })
    expect(screen.getAllByRole('button', { name: /violin/i })).toHaveLength(1)
  })

  it('walks forwards through all five steps', async () => {
    const user = userEvent.setup()
    renderWizard()
    await fillToPreview(user)

    expect(
      screen.getByRole('heading', { name: 'How much time today?' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Step 5 of 5')).toBeInTheDocument()
  })

  it('keeps earlier answers when stepping back', async () => {
    const user = userEvent.setup()
    renderWizard()
    await fillToPreview(user, { goal: 'Scales' })

    await user.click(screen.getByRole('button', { name: 'Back' })) // piece
    await user.click(screen.getByRole('button', { name: 'Back' })) // areas
    await user.click(screen.getByRole('button', { name: 'Back' })) // goal

    expect(screen.getByDisplayValue('Scales')).toBeInTheDocument()
  })

  it('reports "Skip setup" to the caller', async () => {
    const user = userEvent.setup()
    const { onSkip } = renderWizard()
    await user.click(screen.getByRole('button', { name: 'Skip setup' }))
    expect(onSkip).toHaveBeenCalled()
  })

  it('hides the nav until the final step (spec §5.6)', async () => {
    const user = userEvent.setup()
    render(
      <AppShell>
        <QuickStartWizard instruments={[]} onSkip={vi.fn()} onSaved={vi.fn()} />
      </AppShell>,
    )
    expect(screen.queryByRole('navigation', { name: 'Primary' })).toBeNull()

    await fillToPreview(user)
    await waitFor(() =>
      expect(
        screen.getAllByRole('navigation', { name: 'Primary' }).length,
      ).toBeGreaterThan(0),
    )
  })
})

describe('QuickStartWizard — validation', () => {
  it('blocks the instrument step until something is picked', async () => {
    const user = userEvent.setup()
    renderWizard()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Cello' }))
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
  })

  it('needs a name before "Other…" counts as an answer', async () => {
    const user = userEvent.setup()
    renderWizard()
    await user.click(screen.getByRole('button', { name: 'Other…' }))
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()

    await user.type(screen.getByLabelText('Instrument name'), '   ')
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()

    await user.type(screen.getByLabelText('Instrument name'), 'Hurdy-gurdy')
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
  })

  it('blocks the goal step while the field is blank', async () => {
    const user = userEvent.setup()
    renderWizard()
    await user.click(screen.getByRole('button', { name: 'Violin' }))
    await user.click(screen.getByRole('button', { name: 'Next' }))

    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    await user.type(
      screen.getByLabelText('What are you working on right now?'),
      'Sight-reading',
    )
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
  })

  it('needs at least one session area', async () => {
    const user = userEvent.setup()
    renderWizard()
    await user.click(screen.getByRole('button', { name: 'Violin' }))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(
      screen.getByRole('button', { name: /just get me started/ }),
    )

    for (const label of ['Warm-up', 'Scales and technique', 'Repertoire', 'Cool-down']) {
      await user.click(screen.getByRole('checkbox', { name: label }))
    }
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()

    await user.click(screen.getByRole('checkbox', { name: 'Repertoire' }))
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
  })

  it('pre-selects warm-up, scales, repertoire and cool-down', async () => {
    const user = userEvent.setup()
    renderWizard()
    await user.click(screen.getByRole('button', { name: 'Violin' }))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(
      screen.getByRole('button', { name: /just get me started/ }),
    )

    expect(screen.getByRole('checkbox', { name: 'Warm-up' })).toBeChecked()
    expect(
      screen.getByRole('checkbox', { name: 'Scales and technique' }),
    ).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Repertoire' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Cool-down' })).toBeChecked()
    expect(
      screen.getByRole('checkbox', { name: 'Sight-reading' }),
    ).not.toBeChecked()
    expect(
      screen.getByRole('checkbox', { name: 'Ear training' }),
    ).not.toBeChecked()
  })
})

describe('QuickStartWizard — plan preview', () => {
  it('previews the balanced plan for the default 30 minutes', async () => {
    const user = userEvent.setup()
    renderWizard()
    await fillToPreview(user)

    expect(screen.getByText('Violin · 30 minutes · 4 sections')).toBeInTheDocument()
    expect(screen.getByText('Warm-up')).toBeInTheDocument()
    expect(screen.getByText('5 min')).toBeInTheDocument()
    expect(screen.getByText('7 min')).toBeInTheDocument()
    expect(screen.getByText('15 min')).toBeInTheDocument()
    expect(screen.getByText('3 min')).toBeInTheDocument()
  })

  it('rebalances when a different time budget is picked', async () => {
    const user = userEvent.setup()
    renderWizard()
    await fillToPreview(user)

    await user.click(screen.getByRole('radio', { name: '60 min' }))
    expect(screen.getByText('Violin · 60 minutes · 4 sections')).toBeInTheDocument()
    expect(screen.getByText('30 min')).toBeInTheDocument()
  })

  it('shows the named piece as the repertoire line', async () => {
    const user = userEvent.setup()
    renderWizard()
    await fillToPreview(user, { piece: 'Autumn Leaves' })
    expect(screen.getByText('Autumn Leaves')).toBeInTheDocument()
  })

  it('names the plan generically when the goal was skipped', async () => {
    const user = userEvent.setup()
    renderWizard()
    await fillToPreview(user, { goal: '' })
    expect(
      screen.getByRole('heading', { name: 'Daily practice' }),
    ).toBeInTheDocument()
  })
})

describe('QuickStartWizard — submission', () => {
  it('creates the plan and drops into the session', async () => {
    const user = userEvent.setup()
    renderWizard()
    await fillToPreview(user)
    await user.click(screen.getByRole('button', { name: 'Start practicing' }))

    await waitFor(() => expect(mockApi.quickStart).toHaveBeenCalledTimes(1))
    expect(lastRequest()).toEqual({
      instrument_id: undefined,
      instrument_name: 'Violin',
      plan_name: 'Bruch Violin Concerto',
      piece_name: 'Bruch Violin Concerto',
      sections: [
        {
          name: 'Warm-up',
          section_type: 'warmup',
          estimated_duration_minutes: 5,
          block: {
            name: 'Warm-up',
            description: 'Easy playing to loosen up',
          },
        },
        {
          name: 'Scales and technique',
          section_type: 'scales',
          estimated_duration_minutes: 7,
          block: {
            name: 'Scales and technique',
            description: 'Scales and arpeggios, slow and even',
          },
        },
        {
          name: 'Repertoire',
          section_type: 'repertoire',
          estimated_duration_minutes: 15,
          block: {
            name: 'Bruch Violin Concerto',
            description: 'Slow practice on what you are learning',
          },
        },
        {
          name: 'Cool-down',
          section_type: 'cooldown',
          estimated_duration_minutes: 3,
          block: {
            name: 'Cool-down',
            description: 'Easy playing, then reflect on the session',
          },
        },
      ],
    })

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(
        '/session/start?instrument=12&template=34&session=56',
      ),
    )
  })

  it('reuses an instrument the user already has', async () => {
    const user = userEvent.setup()
    renderWizard({ instruments: [makeInstrument({ id: 9, name: 'Cello' })] })

    await user.click(screen.getByRole('button', { name: 'Cello' }))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: /just get me started/ }))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: /Skip — I'll add later/ }))
    await user.click(screen.getByRole('button', { name: 'Start practicing' }))

    await waitFor(() => expect(mockApi.quickStart).toHaveBeenCalled())
    expect(lastRequest().instrument_id).toBe(9)
    expect(lastRequest().instrument_name).toBeUndefined()
  })

  it('omits the piece when the step was skipped', async () => {
    const user = userEvent.setup()
    renderWizard()
    await fillToPreview(user, { piece: '' })
    await user.click(screen.getByRole('button', { name: 'Start practicing' }))

    await waitFor(() => expect(mockApi.quickStart).toHaveBeenCalled())
    expect(lastRequest().piece_name).toBeUndefined()
    expect(lastRequest().sections[2].block.name).toBe('Repertoire')
  })

  it('saves without starting a session', async () => {
    const user = userEvent.setup()
    const { onSaved } = renderWizard()
    await fillToPreview(user)
    await user.click(
      screen.getByRole('button', { name: 'Save plan and practice later' }),
    )

    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('saves the plan before opening the editor to customize it', async () => {
    const user = userEvent.setup()
    renderWizard()
    await fillToPreview(user)
    await user.click(screen.getByRole('button', { name: 'Customize this plan' }))

    await waitFor(() => expect(mockApi.quickStart).toHaveBeenCalled())
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/plans/34'))
  })

  it('surfaces a failure and lets the user try again', async () => {
    const user = userEvent.setup()
    mockApi.quickStart.mockRejectedValueOnce(new Error('API error 500'))
    renderWizard()
    await fillToPreview(user)
    await user.click(screen.getByRole('button', { name: 'Start practicing' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't create your plan: API error 500",
    )
    expect(mockPush).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Start practicing' }))
    await waitFor(() => expect(mockApi.quickStart).toHaveBeenCalledTimes(2))
  })

  it('does not submit twice while a request is in flight', async () => {
    const user = userEvent.setup()
    let release: (value: typeof CREATED) => void = () => {}
    mockApi.quickStart.mockReturnValueOnce(
      new Promise((resolve) => {
        release = resolve
      }),
    )
    renderWizard()
    await fillToPreview(user)

    const start = screen.getByRole('button', { name: 'Start practicing' })
    await user.click(start)
    expect(
      screen.getByRole('button', { name: 'Starting…' }),
    ).toBeDisabled()

    release(CREATED)
    await waitFor(() => expect(mockApi.quickStart).toHaveBeenCalledTimes(1))
  })
})
