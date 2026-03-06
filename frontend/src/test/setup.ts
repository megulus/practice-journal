import type { ReactNode } from 'react'
import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mock next/navigation (App Router)
// ---------------------------------------------------------------------------
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

// ---------------------------------------------------------------------------
// Mock @clerk/nextjs
// ---------------------------------------------------------------------------
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({
    isSignedIn: true,
    getToken: vi.fn().mockResolvedValue('test-token'),
    userId: 'test-user-id',
  }),
  useUser: () => ({
    isSignedIn: true,
    user: {
      id: 'test-user-id',
      firstName: 'Test',
      lastName: 'User',
      primaryEmailAddress: { emailAddress: 'test@example.com' },
    },
  }),
  ClerkProvider: ({ children }: { children: ReactNode }) => children,
  SignedIn: ({ children }: { children: ReactNode }) => children,
  SignedOut: ({ children }: { children: ReactNode }) => null,
  UserButton: () => null,
}))
