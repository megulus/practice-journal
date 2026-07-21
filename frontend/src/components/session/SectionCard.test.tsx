import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, userEvent } from '@/test/utils'
import { SectionCard } from './SectionCard'
import { getSectionColor } from '@/lib/section-colors'
import type { SectionLog, BlockLog } from '@/lib/types'

const { mockUpdateSectionLog } = vi.hoisted(() => ({
  mockUpdateSectionLog: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/useApi', () => ({
  useApi: () => ({
    updateSectionLog: mockUpdateSectionLog,
    addFreeformBlock: vi.fn(),
    updateBlockLog: vi.fn(),
  }),
}))

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
    last_tempo_bpm: null,
    ...overrides,
  }
}

function refs() {
  return {
    pendingFlushes: { current: new Set<() => Promise<void>>() },
    repertoireBlockIds: { current: new Set<number>() },
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
