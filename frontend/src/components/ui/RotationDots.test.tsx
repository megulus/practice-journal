import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/utils'
import { RotationDots } from './RotationDots'

describe('RotationDots', () => {
  it('renders one dot per session with the current position filled', () => {
    render(<RotationDots total={3} current={2} />)
    const group = screen.getByRole('img', { name: 'Session 2 of 3' })
    const dots = group.querySelectorAll('span[aria-hidden="true"]')
    expect(dots).toHaveLength(3)
    expect(dots[1].className).toContain('bg-primary')
    expect(dots[0].className).toContain('bg-border-default')
    expect(dots[2].className).toContain('bg-border-default')
  })

  it('renders nothing when there is no rotation', () => {
    const { container } = render(<RotationDots total={0} current={1} />)
    expect(container).toBeEmptyDOMElement()
  })
})
