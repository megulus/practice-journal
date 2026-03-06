import { describe, it, expect, vi } from 'vitest'
import { render, screen, userEvent } from '@/test/utils'
import DaySelector from './DaySelector'

describe('DaySelector', () => {
  it('renders a button for each day', () => {
    render(<DaySelector daysCount={3} selectedDay={1} onSelectDay={() => {}} />)
    expect(screen.getByText('Day 1')).toBeInTheDocument()
    expect(screen.getByText('Day 2')).toBeInTheDocument()
    expect(screen.getByText('Day 3')).toBeInTheDocument()
  })

  it('highlights the selected day', () => {
    render(<DaySelector daysCount={3} selectedDay={2} onSelectDay={() => {}} />)
    const selectedBtn = screen.getByText('Day 2')
    expect(selectedBtn.className).toContain('bg-primary-500')

    const unselectedBtn = screen.getByText('Day 1')
    expect(unselectedBtn.className).not.toContain('bg-primary-500')
  })

  it('calls onSelectDay when a day is clicked', async () => {
    const onSelectDay = vi.fn()
    render(<DaySelector daysCount={3} selectedDay={1} onSelectDay={onSelectDay} />)

    const user = userEvent.setup()
    await user.click(screen.getByText('Day 3'))
    expect(onSelectDay).toHaveBeenCalledWith(3)
  })

  it('renders nothing when daysCount is 0', () => {
    const { container } = render(
      <DaySelector daysCount={0} selectedDay={1} onSelectDay={() => {}} />
    )
    expect(container.querySelectorAll('button')).toHaveLength(0)
  })
})
