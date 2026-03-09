import { describe, it, expect, vi } from 'vitest'
import { render, screen, userEvent } from '@/test/utils'
import AddBlockPanel from './AddBlockPanel'
import type { BlockType } from '@/lib/types'

const blockTypes: BlockType[] = [
  { id: 1, slug: 'warm-up', label: 'Warm-Up', description: 'Start your session', default_duration_minutes: 10, display_order: 1 },
  { id: 2, slug: 'scales', label: 'Scales', default_duration_minutes: 15, display_order: 0 },
]

describe('AddBlockPanel', () => {
  it('renders block type buttons sorted by display_order', () => {
    render(<AddBlockPanel blockTypes={blockTypes} onAddBlock={() => {}} />)

    const buttons = screen.getAllByRole('button')
    expect(buttons[0]).toHaveTextContent('Scales')
    expect(buttons[1]).toHaveTextContent('Warm-Up')
  })

  it('shows label, description, and duration', () => {
    render(<AddBlockPanel blockTypes={blockTypes} onAddBlock={() => {}} />)
    expect(screen.getByText('Warm-Up')).toBeInTheDocument()
    expect(screen.getByText('Start your session')).toBeInTheDocument()
    expect(screen.getByText('10 min')).toBeInTheDocument()
  })

  it('calls onAddBlock with block type id', async () => {
    const onAddBlock = vi.fn()
    const user = userEvent.setup()

    render(<AddBlockPanel blockTypes={blockTypes} onAddBlock={onAddBlock} />)
    await user.click(screen.getByText('Scales'))
    expect(onAddBlock).toHaveBeenCalledWith(2)
  })

  it('renders nothing when blockTypes is empty', () => {
    const { container } = render(<AddBlockPanel blockTypes={[]} onAddBlock={() => {}} />)
    expect(container.innerHTML).toBe('')
  })
})
