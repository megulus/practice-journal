import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, userEvent } from '@/test/utils'
import { AccountHeader } from './AccountHeader'

const { mockOpenUserProfile, mockUser } = vi.hoisted(() => ({
  mockOpenUserProfile: vi.fn(),
  mockUser: {
    value: {
      firstName: 'Meg',
      lastName: 'Gulotta',
      primaryEmailAddress: { emailAddress: 'meg@example.com' },
    } as Record<string, unknown> | null,
  },
}))

vi.mock('@clerk/nextjs', () => ({
  useUser: () => ({ user: mockUser.value }),
  useClerk: () => ({ openUserProfile: mockOpenUserProfile }),
}))

describe('AccountHeader', () => {
  beforeEach(() => {
    mockOpenUserProfile.mockClear()
    mockUser.value = {
      firstName: 'Meg',
      lastName: 'Gulotta',
      primaryEmailAddress: { emailAddress: 'meg@example.com' },
    }
  })

  it('shows the name, email, and initials', () => {
    render(<AccountHeader />)
    expect(screen.getByText('Meg Gulotta')).toBeInTheDocument()
    expect(screen.getByText('meg@example.com')).toBeInTheDocument()
    expect(screen.getByText('MG')).toBeInTheDocument()
  })

  it('opens Clerk’s account UI from the manage link', async () => {
    const user = userEvent.setup()
    render(<AccountHeader />)
    await user.click(screen.getByRole('button', { name: 'Manage account' }))
    expect(mockOpenUserProfile).toHaveBeenCalledOnce()
  })

  it('falls back to the email when there is no name', () => {
    mockUser.value = {
      primaryEmailAddress: { emailAddress: 'meg@example.com' },
    }
    render(<AccountHeader />)
    // Name line falls back to the email; the email line renders it too.
    expect(screen.getAllByText('meg@example.com')).toHaveLength(2)
    expect(screen.getByText('M')).toBeInTheDocument()
  })
})
