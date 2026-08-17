import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, userEvent, within } from '@/test/utils'
import { SectionCard } from './SectionCard'
import { getSectionColor } from '@/lib/section-colors'
import type { SectionLog, BlockLog } from '@/lib/types'

// A single hoisted object — a fresh one per render would re-run the
// `api`-dependent load effects of nested components forever (#277).
const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    updateSectionLog: vi.fn().mockResolvedValue(undefined),
    addFreeformBlock: vi.fn().mockResolvedValue(undefined),
    updateBlockLog: vi.fn().mockResolvedValue(undefined),
    browseCuratedBlocks: vi.fn().mockResolvedValue([]),
    listRecentBlocks: vi.fn().mockResolvedValue([]),
  },
}))
const mockUpdateSectionLog = mockApi.updateSectionLog

vi.mock('@/lib/useApi', () => ({ useApi: () => mockApi }))

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

function makeBlock(overrides: Partial<BlockLog> = {}): BlockLog {
  return {
    id: 1,
    block_id: null,
    spot_id: null,
    block_name: 'G major scale',
    rating: null,
    notes: null,
    completed: false,
    display_order: 0,
    tempo_bpm: null,
    last_tempo_bpm: null,
    piece_name: null,
    ...overrides,
  }
}

function refs() {
  return {
    pendingFlushes: { current: new Set<() => Promise<void>>() },
    repertoireBlockIds: { current: new Set<number>() },
    instrument: null,
    suggestions: {},
  }
}

const color = getSectionColor('scales', 0)

describe('SectionCard — skip / unskip', () => {
  beforeEach(() => {
    mockUpdateSectionLog.mockClear()
  })

  it('shows the Skipped badge and an Unskip action when skipped', () => {
    render(
      <SectionCard
        logId={1}
        sectionLog={makeSection({ skipped: true })}
        color={color}
        onUpdate={vi.fn()}
        {...refs()}
      />
    )
    expect(screen.getByText('Skipped')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Unskip section' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Skip section' })
    ).not.toBeInTheDocument()
  })

  it('skips the section (skipped: true) when Skip is clicked', async () => {
    const onUpdate = vi.fn()
    const user = userEvent.setup()
    render(
      <SectionCard
        logId={5}
        sectionLog={makeSection({ id: 9, skipped: false })}
        color={color}
        onUpdate={onUpdate}
        {...refs()}
      />
    )
    await user.click(screen.getByRole('button', { name: 'Skip section' }))
    expect(mockUpdateSectionLog).toHaveBeenCalledWith(5, 9, { skipped: true })
    expect(onUpdate).toHaveBeenCalledOnce()
  })

  it('unskips the section (skipped: false) when Unskip is clicked', async () => {
    const user = userEvent.setup()
    render(
      <SectionCard
        logId={5}
        sectionLog={makeSection({ id: 9, skipped: true })}
        color={color}
        onUpdate={vi.fn()}
        {...refs()}
      />
    )
    await user.click(screen.getByRole('button', { name: 'Unskip section' }))
    expect(mockUpdateSectionLog).toHaveBeenCalledWith(5, 9, { skipped: false })
  })
})

describe('SectionCard — completed derived from blocks (#233)', () => {
  it('shows the editable duration stepper while blocks are incomplete', () => {
    render(
      <SectionCard
        logId={1}
        sectionLog={makeSection({ block_logs: [makeBlock({ completed: false })] })}
        color={color}
        onUpdate={vi.fn()}
        {...refs()}
      />
    )
    // Not yet "done": editable stepper, no static completed summary.
    expect(
      screen.getByRole('button', { name: 'Increase duration' })
    ).toBeInTheDocument()
    expect(screen.queryByText(/plan:/)).not.toBeInTheDocument()
  })

  it('shows the static completed summary once every block is complete', () => {
    render(
      <SectionCard
        logId={1}
        sectionLog={makeSection({
          actual_duration_minutes: 12,
          planned_duration_minutes: 10,
          block_logs: [
            makeBlock({ id: 1, completed: true }),
            makeBlock({ id: 2, completed: true }),
          ],
        })}
        color={color}
        onUpdate={vi.fn()}
        {...refs()}
      />
    )
    expect(screen.getByText(/12 min/)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Increase duration' })
    ).not.toBeInTheDocument()
  })
})

describe('SectionCard — in-session suggestions (#180)', () => {
  it('routes each suggestion to the block row it is keyed to', () => {
    render(
      <SectionCard
        logId={1}
        sectionLog={makeSection({
          block_logs: [
            makeBlock({ id: 1, block_name: 'G major scale' }),
            makeBlock({ id: 2, block_name: 'Thirds' }),
          ],
        })}
        color={color}
        {...refs()}
        suggestions={{
          '2': { rule_id: 'tempo_progression', text: 'Try 4 bpm faster today.' },
        }}
        onUpdate={vi.fn()}
      />
    )

    expect(screen.getAllByRole('note')).toHaveLength(1)

    // …and it sits inside the "Thirds" row, not the other block's
    const row = (name: string) =>
      screen.getByText(name).closest('[class*="py-3"]') as HTMLElement
    expect(within(row('Thirds')).getByRole('note')).toHaveTextContent(
      'Try 4 bpm faster today.'
    )
    expect(within(row('G major scale')).queryByRole('note')).toBeNull()
  })
})

describe('SectionCard — repertoire piece names (#274)', () => {
  it('renders a piece title containing " — " in full', () => {
    render(
      <SectionCard
        logId={1}
        sectionLog={makeSection({
          block_logs: [
            makeBlock({
              id: 1,
              block_id: 5,
              spot_id: 50,
              block_name: 'Sonata — No. 2 — mm. 1–8',
              piece_name: 'Sonata — No. 2',
            }),
            makeBlock({
              id: 2,
              block_id: 5,
              spot_id: 51,
              block_name: 'Sonata — No. 2 — coda',
              piece_name: 'Sonata — No. 2',
            }),
          ],
        })}
        color={color}
        onUpdate={vi.fn()}
        {...refs()}
      />
    )

    expect(screen.getByText('Sonata — No. 2')).toBeInTheDocument()
    // Spot rows sit under the piece header, so they drop the whole prefix.
    expect(screen.getByText('mm. 1–8')).toBeInTheDocument()
    expect(screen.getByText('coda')).toBeInTheDocument()
  })
})
