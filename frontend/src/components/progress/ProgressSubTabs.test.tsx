import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, userEvent } from '@/test/utils'
import { ProgressSubTabs, type ProgressSubTab } from './ProgressSubTabs'

describe('ProgressSubTabs', () => {
  it('marks the current sub-tab as selected', () => {
    render(<ProgressSubTabs value="history" onChange={vi.fn()} />)

    expect(screen.getByRole('tab', { name: 'History' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('tab', { name: 'Insights' })).toHaveAttribute(
      'aria-selected',
      'false',
    )
  })

  it('reports the tab the user picked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ProgressSubTabs value="history" onChange={onChange} />)

    await user.click(screen.getByRole('tab', { name: 'Insights' }))
    expect(onChange).toHaveBeenCalledWith('insights')
  })

  it('puts only the selected tab in the tab order (roving tabindex)', () => {
    render(<ProgressSubTabs value="history" onChange={vi.fn()} />)

    expect(screen.getByRole('tab', { name: 'History' })).toHaveAttribute(
      'tabindex',
      '0',
    )
    expect(screen.getByRole('tab', { name: 'Insights' })).toHaveAttribute(
      'tabindex',
      '-1',
    )
  })

  it('moves between tabs with the arrow keys, wrapping at the ends', async () => {
    const user = userEvent.setup()
    // Controlled for real — a bare spy would leave `value` pinned and the
    // wrap-around assertions would be meaningless.
    function Harness() {
      const [value, setValue] = useState<ProgressSubTab>('history')
      return <ProgressSubTabs value={value} onChange={setValue} />
    }
    render(<Harness />)

    const history = screen.getByRole('tab', { name: 'History' })
    const insights = screen.getByRole('tab', { name: 'Insights' })

    history.focus()
    await user.keyboard('{ArrowRight}')
    expect(insights).toHaveAttribute('aria-selected', 'true')
    expect(insights).toHaveFocus()

    // Wraps forward off the end, back to the first tab.
    await user.keyboard('{ArrowRight}')
    expect(history).toHaveAttribute('aria-selected', 'true')
    expect(history).toHaveFocus()

    await user.keyboard('{End}')
    expect(insights).toHaveAttribute('aria-selected', 'true')

    await user.keyboard('{Home}')
    expect(history).toHaveAttribute('aria-selected', 'true')
  })

  it('only points aria-controls at the panel that is actually rendered', () => {
    render(<ProgressSubTabs value="history" onChange={vi.fn()} />)

    expect(screen.getByRole('tab', { name: 'History' })).toHaveAttribute(
      'aria-controls',
      'progress-panel-history',
    )
    // The Insights panel isn't in the DOM, so referencing it would dangle.
    expect(
      screen.getByRole('tab', { name: 'Insights' }),
    ).not.toHaveAttribute('aria-controls')
  })
})
