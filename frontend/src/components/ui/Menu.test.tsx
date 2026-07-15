import { describe, it, expect, vi } from 'vitest'
import { ArrowUp } from 'lucide-react'
import { render, screen, userEvent } from '@/test/utils'
import { Menu } from './Menu'

describe('Menu', () => {
  it('renders the default trigger with an accessible label', () => {
    render(
      <Menu
        items={[{ label: 'Delete', onSelect: vi.fn() }]}
        triggerLabel="Block actions"
      />
    )
    expect(
      screen.getByRole('button', { name: 'Block actions' })
    ).toBeInTheDocument()
  })

  it('opens on trigger click and shows the items', async () => {
    const user = userEvent.setup()
    render(
      <Menu
        items={[
          { label: 'Move up', onSelect: vi.fn() },
          { label: 'Delete', onSelect: vi.fn(), destructive: true },
        ]}
      />
    )
    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    expect(
      await screen.findByRole('menuitem', { name: 'Move up' })
    ).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument()
  })

  it('calls onSelect when an item is chosen', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<Menu items={[{ label: 'Delete', onSelect }]} />)
    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    expect(onSelect).toHaveBeenCalledOnce()
  })

  it('does not fire onSelect for a disabled item', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<Menu items={[{ label: 'Delete', onSelect, disabled: true }]} />)
    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('supports a custom trigger', async () => {
    const user = userEvent.setup()
    render(
      <Menu
        trigger={<button>Custom</button>}
        items={[
          { label: 'Move up', icon: <ArrowUp size={14} />, onSelect: vi.fn() },
        ]}
      />
    )
    await user.click(screen.getByRole('button', { name: 'Custom' }))
    expect(
      await screen.findByRole('menuitem', { name: 'Move up' })
    ).toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    render(<Menu items={[{ label: 'Delete', onSelect: vi.fn() }]} />)
    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    expect(
      await screen.findByRole('menuitem', { name: 'Delete' })
    ).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(
      screen.queryByRole('menuitem', { name: 'Delete' })
    ).not.toBeInTheDocument()
  })
})
