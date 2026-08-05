import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, userEvent, waitFor } from '@/test/utils'
import { TempoField } from './TempoField'
import type { BlockLog } from '@/lib/types'

const { mockApi } = vi.hoisted(() => ({
  mockApi: { updateBlockLog: vi.fn().mockResolvedValue(undefined) },
}))

vi.mock('@/lib/useApi', () => ({ useApi: () => mockApi }))

function makeLog(overrides: Partial<BlockLog> = {}): BlockLog {
  return {
    id: 7,
    block_id: 3,
    spot_id: null,
    block_name: 'G major scale',
    rating: null,
    notes: null,
    completed: false,
    display_order: 0,
    tempo_bpm: null,
    last_tempo_bpm: null,
    ...overrides,
  }
}

const field = () => screen.getByLabelText('Tempo in bpm for G major scale')

describe('TempoField — smart tempo defaults (#181)', () => {
  beforeEach(() => {
    mockApi.updateBlockLog.mockClear()
    mockApi.updateBlockLog.mockResolvedValue(undefined)
  })

  it('pre-fills from last_tempo_bpm in muted text', () => {
    render(<TempoField logId={1} blockLog={makeLog({ last_tempo_bpm: 72 })} />)

    expect(field()).toHaveValue('72')
    expect(field()).toHaveClass('text-text-tertiary')
    expect(field()).not.toHaveClass('text-text-primary')
  })

  it('shows a placeholder and no value when there is no prior tempo', () => {
    render(<TempoField logId={1} blockLog={makeLog()} />)

    expect(field()).toHaveValue('')
    expect(field()).toHaveAttribute('placeholder', '—')
    expect(screen.getByText('bpm')).toBeInTheDocument()
  })

  it('confirms the pre-filled tempo on focus + blur and turns primary', async () => {
    const user = userEvent.setup()
    render(<TempoField logId={1} blockLog={makeLog({ last_tempo_bpm: 72 })} />)

    await user.click(field())
    await user.tab()

    await waitFor(() =>
      expect(mockApi.updateBlockLog).toHaveBeenCalledExactlyOnceWith(1, 7, {
        tempo_bpm: 72,
      })
    )
    expect(field()).toHaveClass('text-text-primary')
  })

  it('persists an adjusted tempo', async () => {
    const user = userEvent.setup()
    render(<TempoField logId={1} blockLog={makeLog({ last_tempo_bpm: 72 })} />)

    await user.clear(field())
    await user.type(field(), '80')
    await user.tab()

    await waitFor(() =>
      expect(mockApi.updateBlockLog).toHaveBeenCalledExactlyOnceWith(1, 7, {
        tempo_bpm: 80,
      })
    )
    expect(field()).toHaveClass('text-text-primary')
  })

  it('starts primary and saves nothing when a tempo was already logged', async () => {
    const user = userEvent.setup()
    render(
      <TempoField
        logId={1}
        blockLog={makeLog({ tempo_bpm: 96, last_tempo_bpm: 72 })}
      />
    )

    expect(field()).toHaveValue('96')
    expect(field()).toHaveClass('text-text-primary')

    await user.click(field())
    await user.tab()
    expect(mockApi.updateBlockLog).not.toHaveBeenCalled()
  })

  it('clears a logged tempo when the field is emptied', async () => {
    const user = userEvent.setup()
    render(<TempoField logId={1} blockLog={makeLog({ tempo_bpm: 96 })} />)

    await user.clear(field())
    await user.tab()

    await waitFor(() =>
      expect(mockApi.updateBlockLog).toHaveBeenCalledExactlyOnceWith(1, 7, {
        tempo_bpm: null,
      })
    )
    expect(field()).toHaveClass('text-text-tertiary')
  })

  it('ignores non-numeric input and clamps to the allowed range', async () => {
    const user = userEvent.setup()
    render(<TempoField logId={1} blockLog={makeLog()} />)

    await user.type(field(), 'ab999')
    expect(field()).toHaveValue('999')

    await user.tab()
    await waitFor(() =>
      expect(mockApi.updateBlockLog).toHaveBeenCalledExactlyOnceWith(1, 7, {
        tempo_bpm: 400,
      })
    )
    expect(field()).toHaveValue('400')
  })

  it('rolls back to the last saved value when the save fails', async () => {
    mockApi.updateBlockLog.mockRejectedValueOnce(new Error('offline'))
    const user = userEvent.setup()
    render(<TempoField logId={1} blockLog={makeLog({ last_tempo_bpm: 72 })} />)

    await user.clear(field())
    await user.type(field(), '80')
    await user.tab()

    await waitFor(() => expect(field()).toHaveValue(''))
    expect(field()).toHaveClass('text-text-tertiary')
  })
})
