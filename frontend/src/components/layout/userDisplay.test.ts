import { describe, it, expect } from 'vitest'
import { getUserDisplay } from './userDisplay'

describe('getUserDisplay', () => {
  it('builds name and initials from first + last name', () => {
    const d = getUserDisplay({
      firstName: 'Ada',
      lastName: 'Lovelace',
      primaryEmailAddress: { emailAddress: 'ada@example.com' },
    })
    expect(d).toEqual({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      initials: 'AL',
    })
  })

  it('handles a missing last name', () => {
    const d = getUserDisplay({ firstName: 'Ada', primaryEmailAddress: null })
    expect(d.name).toBe('Ada')
    expect(d.initials).toBe('A')
  })

  it('falls back to the email when there is no name', () => {
    const d = getUserDisplay({
      primaryEmailAddress: { emailAddress: 'solo@example.com' },
    })
    expect(d.name).toBe('solo@example.com')
    expect(d.initials).toBe('S')
  })

  it('falls back to Account / ? when the user is null', () => {
    expect(getUserDisplay(null)).toEqual({
      name: 'Account',
      email: '',
      initials: '?',
    })
  })
})
