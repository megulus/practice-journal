import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, userEvent } from '@/test/utils'
import { PillRadioGroup } from './PillRadioGroup'

const OPTIONS = [15, 30, 45].map((value) => ({
  value,
  label: `${value} min`,
}))

/** Controlled wrapper, so selection-follows-focus actually re-renders. */
function Harness({
  initial = 30,
  onChange,
}: {
  initial?: number
  onChange?: (value: number) => void
}) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <button type="button">before</button>
      <PillRadioGroup
        label="Duration"
        options={OPTIONS}
        value={value}
        onChange={(next) => {
          setValue(next)
          onChange?.(next)
        }}
      />
      <button type="button">after</button>
    </>
  )
}

describe('PillRadioGroup', () => {
  it('renders a radiogroup of radios with the checked one marked', () => {
    render(<Harness />)
    const group = screen.getByRole('radiogroup', { name: 'Duration' })
    expect(group).toBeInTheDocument()
    const radios = screen.getAllByRole('radio')
    expect(radios.map((r) => r.textContent)).toEqual([
      '15 min',
      '30 min',
      '45 min',
    ])
    expect(radios[1]).toHaveAttribute('aria-checked', 'true')
    expect(radios[0]).toHaveAttribute('aria-checked', 'false')
  })

  it('is a single tab stop, on the checked option', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const radios = screen.getAllByRole('radio')
    expect(radios.map((r) => r.getAttribute('tabindex'))).toEqual([
      '-1',
      '0',
      '-1',
    ])

    await user.tab() // into "before"
    await user.tab() // into the group — lands on the checked pill
    expect(radios[1]).toHaveFocus()
    await user.tab() // straight out of the group, not onto the next pill
    expect(screen.getByRole('button', { name: 'after' })).toHaveFocus()
  })

  it('puts the tab stop on the first option when nothing is checked', () => {
    render(<Harness initial={999} />)
    expect(
      screen.getAllByRole('radio').map((r) => r.getAttribute('tabindex')),
    ).toEqual(['0', '-1', '-1'])
  })

  it('moves with the arrow keys, selection following focus', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Harness onChange={onChange} />)
    const radios = screen.getAllByRole('radio')

    radios[1].focus()
    await user.keyboard('{ArrowRight}')
    expect(onChange).toHaveBeenLastCalledWith(45)
    expect(radios[2]).toHaveFocus()
    expect(radios[2]).toHaveAttribute('aria-checked', 'true')

    await user.keyboard('{ArrowLeft}')
    expect(onChange).toHaveBeenLastCalledWith(30)
    expect(radios[1]).toHaveFocus()

    // Up/Down are equivalent to Left/Right for a radiogroup.
    await user.keyboard('{ArrowDown}')
    expect(radios[2]).toHaveFocus()
    await user.keyboard('{ArrowUp}')
    expect(radios[1]).toHaveFocus()
  })

  it('wraps around at both ends', async () => {
    const user = userEvent.setup()
    render(<Harness initial={15} />)
    const radios = screen.getAllByRole('radio')

    radios[0].focus()
    await user.keyboard('{ArrowLeft}')
    expect(radios[2]).toHaveFocus()
    expect(radios[2]).toHaveAttribute('aria-checked', 'true')

    await user.keyboard('{ArrowRight}')
    expect(radios[0]).toHaveFocus()
    expect(radios[0]).toHaveAttribute('aria-checked', 'true')
  })

  it('selects on click', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Harness onChange={onChange} />)
    await user.click(screen.getByRole('radio', { name: '45 min' }))
    expect(onChange).toHaveBeenCalledWith(45)
    expect(screen.getByRole('radio', { name: '45 min' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })
})
