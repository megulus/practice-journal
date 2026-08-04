import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@/test/utils'
import { PracticeHeatmap } from './PracticeHeatmap'

describe('PracticeHeatmap', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 21)) // Tue, Jul 21 2026
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shades each day by how long the session was', () => {
    render(
      <PracticeHeatmap
        year={2026}
        days={[
          { date: '2026-03-02', duration_minutes: 10 },
          { date: '2026-03-03', duration_minutes: 20 },
          { date: '2026-03-04', duration_minutes: 45 },
          { date: '2026-03-05', duration_minutes: 90 },
        ]}
      />,
    )

    expect(screen.getByTestId('heatmap-cell-2026-03-02')).toHaveAttribute(
      'data-level',
      '1',
    )
    expect(screen.getByTestId('heatmap-cell-2026-03-03')).toHaveAttribute(
      'data-level',
      '2',
    )
    expect(screen.getByTestId('heatmap-cell-2026-03-04')).toHaveAttribute(
      'data-level',
      '3',
    )
    expect(screen.getByTestId('heatmap-cell-2026-03-05')).toHaveAttribute(
      'data-level',
      '4',
    )
    expect(screen.getByTestId('heatmap-cell-2026-03-06')).toHaveAttribute(
      'data-level',
      '0',
    )
  })

  it('labels a cell with its date and duration', () => {
    render(
      <PracticeHeatmap
        year={2026}
        days={[{ date: '2026-03-02', duration_minutes: 45 }]}
      />,
    )

    expect(screen.getByTestId('heatmap-cell-2026-03-02')).toHaveAttribute(
      'title',
      'Mon, Mar 2 — 45 min',
    )
    expect(screen.getByTestId('heatmap-cell-2026-03-03')).toHaveAttribute(
      'title',
      'Tue, Mar 3 — no practice',
    )
  })

  it('leaves days after today blank rather than empty squares', () => {
    render(<PracticeHeatmap year={2026} days={[]} />)

    expect(screen.getByTestId('heatmap-cell-2026-07-21')).toBeInTheDocument()
    expect(
      screen.queryByTestId('heatmap-cell-2026-07-22'),
    ).not.toBeInTheDocument()
  })

  it('summarizes the year above the grid and for screen readers', () => {
    render(
      <PracticeHeatmap
        year={2026}
        days={[
          { date: '2026-03-02', duration_minutes: 45 },
          { date: '2026-03-04', duration_minutes: 60 },
        ]}
      />,
    )

    expect(
      screen.getByText('2 days practiced in 2026, 1 hr 45 min total.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: /Practice calendar for 2026/ }),
    ).toBeInTheDocument()
  })

  it('says so when the year is empty', () => {
    render(<PracticeHeatmap year={2026} days={[]} />)
    expect(screen.getByText('No practice logged in 2026.')).toBeInTheDocument()
  })

  it('shows the Less → More legend', () => {
    render(<PracticeHeatmap year={2026} days={[]} />)
    expect(screen.getByText('Less')).toBeInTheDocument()
    expect(screen.getByText('More')).toBeInTheDocument()
  })

  it('opens scrolled toward the current week', () => {
    // jsdom does no layout, so stand in a viewport narrower than the grid.
    const widthSpy = vi
      .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
      .mockReturnValue(300)
    const scrollLeft = vi.fn()
    const leftSpy = vi
      .spyOn(HTMLElement.prototype, 'scrollLeft', 'set')
      .mockImplementation(scrollLeft)

    render(<PracticeHeatmap year={2026} days={[]} />)

    expect(scrollLeft).toHaveBeenCalledTimes(1)
    // Jul 21 is week 29 of the grid, ending 449px in; 449 - 300 viewport.
    expect(scrollLeft).toHaveBeenCalledWith(149)
    widthSpy.mockRestore()
    leftSpy.mockRestore()
  })

  it('runs a month label across the top', () => {
    render(<PracticeHeatmap year={2026} days={[]} />)
    for (const month of ['Jan', 'Jun', 'Dec']) {
      expect(screen.getByText(month)).toBeInTheDocument()
    }
  })
})
