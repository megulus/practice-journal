import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useState } from 'react'
import { render, screen, userEvent, waitFor } from '@/test/utils'
import { LocationInput, orderChips } from './LocationInput'

function Harness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial)
  return <LocationInput value={value} onChange={setValue} />
}

describe('orderChips', () => {
  it('floats recently used chips to the front, keeping the rest in order', () => {
    expect(orderChips(['to', 'mm.'])).toEqual([
      'to',
      'mm.',
      'page',
      'letter',
      '–',
    ])
  })

  it('ignores chips that are no longer part of the set', () => {
    expect(orderChips(['bogus'])).toEqual(['mm.', 'page', 'letter', 'to', '–'])
  })
})

describe('LocationInput', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('builds a location from chips and typing, spacing as it goes', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const input = screen.getByLabelText('Location')

    await user.click(screen.getByRole('button', { name: /Insert “mm.”/ }))
    expect(input).toHaveValue('mm. ')

    // The caret stays in the field, so typing continues where the chip left off.
    await user.type(input, '34')
    await user.click(screen.getByRole('button', { name: /Insert “to”/ }))
    await user.type(input, '41')
    expect(input).toHaveValue('mm. 34 to 41')
  })

  it('inserts mid-string at the caret rather than appending', async () => {
    const user = userEvent.setup()
    render(<Harness initial="mm. 12 41" />)
    const input = screen.getByLabelText('Location') as HTMLInputElement

    input.setSelectionRange(6, 6) // right after "mm. 12"
    await user.click(screen.getByRole('button', { name: /Insert “to”/ }))

    expect(input).toHaveValue('mm. 12 to 41')
  })

  it('remembers recently used chips across mounts', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<Harness />)
    await user.click(screen.getByRole('button', { name: /Insert “letter”/ }))
    unmount()

    render(<Harness />)
    await waitFor(() => {
      const chips = screen
        .getAllByRole('button')
        .map((b) => b.textContent?.trim())
      expect(chips[0]).toBe('letter')
    })
  })

  it('still types normally when storage is unavailable', async () => {
    const spy = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('denied')
      })
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(screen.getByLabelText('Location'), 'page 4')
    expect(screen.getByLabelText('Location')).toHaveValue('page 4')
    spy.mockRestore()
  })
})
