import { describe, it, expect } from 'vitest'
import { resolveApiBaseUrl } from './apiBaseUrl'

describe('resolveApiBaseUrl', () => {
  it('falls back to the local backend only when unset', () => {
    expect(resolveApiBaseUrl(undefined)).toBe('http://localhost:8000')
  })

  it('keeps an empty value: same-origin, not the localhost fallback', () => {
    expect(resolveApiBaseUrl('')).toBe('')
  })

  it('passes absolute and prefix values through unchanged', () => {
    expect(resolveApiBaseUrl('https://api.kantelo.app')).toBe('https://api.kantelo.app')
    expect(resolveApiBaseUrl('/kantelo-api')).toBe('/kantelo-api')
  })
})
