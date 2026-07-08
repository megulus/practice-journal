import { describe, it, expect, vi } from 'vitest'
import { render } from '@/test/utils'
import SessionBootstrap from './SessionBootstrap'

const { mockGetMe } = vi.hoisted(() => ({
  mockGetMe: vi.fn().mockResolvedValue({ id: 1 }),
}))

vi.mock('@/lib/useApi', () => ({
  useApi: () => ({ getMe: mockGetMe }),
}))

describe('SessionBootstrap', () => {
  it('calls GET /me exactly once on mount and renders nothing', () => {
    const { container } = render(<SessionBootstrap />)
    expect(mockGetMe).toHaveBeenCalledOnce()
    expect(container).toBeEmptyDOMElement()
  })
})
