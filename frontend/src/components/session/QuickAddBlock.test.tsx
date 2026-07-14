import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, userEvent } from '@/test/utils'
import { QuickAddBlock } from './QuickAddBlock'

const { mockAddFreeformBlock } = vi.hoisted(() => ({
  mockAddFreeformBlock: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/useApi', () => ({
  useApi: () => ({ addFreeformBlock: mockAddFreeformBlock }),
}))

describe('QuickAddBlock', () => {
  beforeEach(() => {
    mockAddFreeformBlock.mockClear()
  })

  it('adds a trimmed block and clears the input on submit', async () => {
    const onAdd = vi.fn()
    const user = userEvent.setup()
    render(<QuickAddBlock logId={1} sectionLogId={2} onAdd={onAdd} />)

    const input = screen.getByPlaceholderText('Add something else...')
    await user.type(input, '  Long tones  {Enter}')

    expect(mockAddFreeformBlock).toHaveBeenCalledExactlyOnceWith(1, 2, {
      block_name: 'Long tones',
    })
    expect(onAdd).toHaveBeenCalledOnce()
    expect(input).toHaveValue('')
  })

  it('does nothing when the input is empty', async () => {
    const onAdd = vi.fn()
    const user = userEvent.setup()
    render(<QuickAddBlock logId={1} sectionLogId={2} onAdd={onAdd} />)

    const input = screen.getByPlaceholderText('Add something else...')
    await user.type(input, '   {Enter}')

    expect(mockAddFreeformBlock).not.toHaveBeenCalled()
    expect(onAdd).not.toHaveBeenCalled()
  })
})
