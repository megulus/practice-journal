import { describe, it, expect, vi } from 'vitest'
import { render, screen, userEvent } from '@/test/utils'
import { ProgressSubTabs } from './ProgressSubTabs'

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
})
