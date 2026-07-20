import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, userEvent } from '@/test/utils'
import { SectionCard } from './SectionCard'
import { getSectionColor } from '@/lib/section-colors'
import type { SectionLog } from '@/lib/types'

const { mockUpdateSectionLog } = vi.hoisted(() => ({
  mockUpdateSectionLog: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/useApi', () => ({
  useApi: () => ({
    updateSectionLog: mockUpdateSectionLog,
    addFreeformBlock: vi.fn(),
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
