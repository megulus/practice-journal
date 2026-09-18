import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@/test/utils'
import { PracticeHeatmap } from './PracticeHeatmap'

function gutterLabels(): string[] {
  return Array.from(
    screen.getByTestId('heatmap-day-labels').children,
  ).map((el) => el.textContent ?? '')
}

/** Which of the seven slots in its week column a cell renders into. */
function rowIndexOf(date: string): number {
  const cell = screen.getByTestId(`heatmap-cell-${date}`)
  return Array.from(cell.parentElement!.children).indexOf(cell)
}

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
        weekStartsOn="monday"
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
        weekStartsOn="monday"
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
    render(<PracticeHeatmap year={2026} days={[]} weekStartsOn="monday" />)

    expect(screen.getByTestId('heatmap-cell-2026-07-21')).toBeInTheDocument()
    expect(
      screen.queryByTestId('heatmap-cell-2026-07-22'),
    ).not.toBeInTheDocument()
  })

  it('summarizes the year above the grid and for screen readers', () => {
    render(
      <PracticeHeatmap
        year={2026}
        weekStartsOn="monday"
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
    render(<PracticeHeatmap year={2026} days={[]} weekStartsOn="monday" />)
    expect(screen.getByText('No practice logged in 2026.')).toBeInTheDocument()
  })

  it('shows the Less → More legend', () => {
    render(<PracticeHeatmap year={2026} days={[]} weekStartsOn="monday" />)
    expect(screen.getByText('Less')).toBeInTheDocument()
    expect(screen.getByText('More')).toBeInTheDocument()
  })

  it('makes the scroll region a focusable, named tab stop', async () => {
    render(<PracticeHeatmap year={2026} days={[]} weekStartsOn="monday" />)

    // A year is wider than the card. Without a focusable scroll container the
    // months off-screen are mouse-only (WCAG 2.1.1).
    const region = screen.getByRole('img', { name: 'Practice calendar for 2026' })
    expect(region).toHaveAttribute('tabindex', '0')
    expect(region.className).toContain('overflow-x-auto')

    region.focus()
    expect(region).toHaveFocus()
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

    render(<PracticeHeatmap year={2026} days={[]} weekStartsOn="monday" />)

    expect(scrollLeft).toHaveBeenCalledTimes(1)
    // Jul 21 is week 29 of the grid, ending 449px in; 449 - 300 viewport.
    expect(scrollLeft).toHaveBeenCalledWith(149)
    widthSpy.mockRestore()
    leftSpy.mockRestore()
  })

  it('orders the weekday gutter by the week-start preference', () => {
    // The row labels and the grid's row order are the same decision, so this
    // pins the half the component owns; heatmapGrid.test.ts pins the bucketing.
    const { unmount } = render(
      <PracticeHeatmap year={2026} days={[]} weekStartsOn="monday" />,
    )
    expect(gutterLabels()).toEqual(['Mon', '', 'Wed', '', 'Fri', '', ''])
    unmount()

    render(<PracticeHeatmap year={2026} days={[]} weekStartsOn="sunday" />)
    expect(gutterLabels()).toEqual(['', 'Mon', '', 'Wed', '', 'Fri', ''])
  })

  it('moves a day to the row its week start implies', () => {
    // Sun Mar 1 2026 is the last row of a Monday-first week and the first row
    // of a Sunday-first one.
    const days = [{ date: '2026-03-01', duration_minutes: 45 }]

    const { unmount } = render(
      <PracticeHeatmap year={2026} days={days} weekStartsOn="monday" />,
    )
    expect(rowIndexOf('2026-03-01')).toBe(6)
    unmount()

    render(<PracticeHeatmap year={2026} days={days} weekStartsOn="sunday" />)
    expect(rowIndexOf('2026-03-01')).toBe(0)
  })

  it('runs a month label across the top', () => {
    render(<PracticeHeatmap year={2026} days={[]} weekStartsOn="monday" />)
    for (const month of ['Jan', 'Jun', 'Dec']) {
      expect(screen.getByText(month)).toBeInTheDocument()
    }
  })
})
