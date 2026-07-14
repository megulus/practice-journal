import { describe, it, expect } from 'vitest'
import { render } from '@/test/utils'
import { SectionTypeIcon } from './SectionTypeIcon'

describe('SectionTypeIcon', () => {
  it('maps a known section type to its color class', () => {
    const { container } = render(<SectionTypeIcon type="repertoire" />)
    expect(container.firstChild).toHaveClass('bg-purple-400')
  })

  it('falls back to gray for an unknown section type', () => {
    const { container } = render(<SectionTypeIcon type="mystery" />)
    expect(container.firstChild).toHaveClass('bg-gray-400')
  })
})
