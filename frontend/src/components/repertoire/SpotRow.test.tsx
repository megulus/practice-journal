import { describe, it, expect, vi } from 'vitest'
import { render, screen, userEvent, within } from '@/test/utils'
import { SpotRow } from './SpotRow'
import type { Spot } from '@/lib/types'

function makeSpot(o: Partial<Spot> = {}): Spot {
  return {
    id: 5,
    name: 'Coda run',
    location: 'mm. 34 to 41',
    display_order: 0,
    retired_at: null,
    session_count: 4,
    last_practiced_at: null,
    ...o,
  }
}

function renderRow(spot: Spot, handlers: Partial<Parameters<typeof SpotRow>[0]> = {}) {
  const props = {
    spot,
    onEdit: vi.fn().mockResolvedValue(true),
    onRetire: vi.fn(),
    onUnretire: vi.fn(),
    onDelete: vi.fn(),
    onViewHistory: vi.fn(),
    ...handlers,
  }
  render(
    <ul>
      <SpotRow {...props} />
    </ul>,
  )
  return props
}

describe('SpotRow', () => {
  it('shows the name, location, and practice summary', () => {
    renderRow(makeSpot())
    expect(screen.getByText('Coda run')).toBeInTheDocument()
    expect(screen.getByText('mm. 34 to 41')).toBeInTheDocument()
    expect(
      screen.getByText('4 sessions · never practiced'),
    ).toBeInTheDocument()
  })

  it('retires without a confirmation step', async () => {
    const user = userEvent.setup()
    const props = renderRow(makeSpot())
    await user.click(screen.getByRole('button', { name: 'Coda run actions' }))
    await user.click(
      await screen.findByRole('menuitem', { name: 'Retire from rotation' }),
    )
    expect(props.onRetire).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('offers "Bring back" for a retired spot and notes when it was retired', async () => {
    const user = userEvent.setup()
    const props = renderRow(
      makeSpot({ retired_at: new Date().toISOString() }),
    )
    expect(screen.getByText(/retired today/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Coda run actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Bring back' }))
    expect(props.onUnretire).toHaveBeenCalledOnce()
    expect(
      screen.queryByRole('menuitem', { name: 'Retire from rotation' }),
    ).not.toBeInTheDocument()
  })

  it('confirms before deleting, steering toward retire when there is history', async () => {
    const user = userEvent.setup()
    const props = renderRow(makeSpot({ session_count: 4 }))
    await user.click(screen.getByRole('button', { name: 'Coda run actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent(/Retire it instead/)
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(props.onDelete).toHaveBeenCalledOnce()
  })

  it('edits the name and location inline', async () => {
    const user = userEvent.setup()
    const props = renderRow(makeSpot())
    await user.click(screen.getByRole('button', { name: 'Coda run actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Edit spot' }))

    const name = screen.getByLabelText('Spot name')
    await user.clear(name)
    await user.type(name, 'Coda')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(props.onEdit).toHaveBeenCalledWith({
      name: 'Coda',
      location: 'mm. 34 to 41',
    })
    // Closed on success.
    expect(screen.queryByLabelText('Spot name')).not.toBeInTheDocument()
  })

  it('keeps the edit form open when the save fails', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn().mockResolvedValue(false)
    renderRow(makeSpot(), { onEdit })
    await user.click(screen.getByRole('button', { name: 'Coda run actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Edit spot' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByLabelText('Spot name')).toHaveValue('Coda run')
  })

  it('opens the history view', async () => {
    const user = userEvent.setup()
    const props = renderRow(makeSpot())
    await user.click(screen.getByRole('button', { name: 'Coda run actions' }))
    await user.click(
      await screen.findByRole('menuitem', { name: 'View history' }),
    )
    expect(props.onViewHistory).toHaveBeenCalledOnce()
  })
})
