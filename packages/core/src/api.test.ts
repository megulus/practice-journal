import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createAuthenticatedAPI, APIError } from './api'

function mockResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
}

const BASE = 'http://localhost:8000'

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('createAuthenticatedAPI — baseUrl', () => {
  it.each([
    ['an origin', 'https://api.example.test', 'https://api.example.test/api/user/me'],
    ['a same-origin prefix', '/kantelo-api', '/kantelo-api/api/user/me'],
    ['empty (same-origin)', '', '/api/user/me'],
  ])('prefixes every request with %s', async (_label, baseUrl, expected) => {
    fetchMock.mockResolvedValue(mockResponse(200, { id: 1 }))
    const api = createAuthenticatedAPI({
      baseUrl,
      getToken: vi.fn().mockResolvedValue('tok'),
    })

    await api.getMe()

    expect(fetchMock).toHaveBeenCalledWith(expected, expect.anything())
  })
})

describe('createAuthenticatedAPI — auth + 401 retry', () => {
  it('sends the bearer token and returns parsed JSON', async () => {
    fetchMock.mockResolvedValue(mockResponse(200, { id: 1 }))
    const getToken = vi.fn().mockResolvedValue('tok')

    const api = createAuthenticatedAPI({ baseUrl: BASE, getToken })
    const user = await api.getMe()

    expect(user).toEqual({ id: 1 })
    expect(getToken).toHaveBeenCalledTimes(1)
    expect(getToken).toHaveBeenCalledWith(undefined) // no skipCache on first try
    const [, opts] = fetchMock.mock.calls[0]
    expect(opts.headers.Authorization).toBe('Bearer tok')
  })

  it('still sends the request, unauthenticated, when getToken throws', async () => {
    // Clerk Core 3's getToken() throws when offline instead of resolving null.
    fetchMock.mockResolvedValue(mockResponse(200, { id: 1 }))
    const getToken = vi.fn().mockRejectedValue(new Error('offline'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const api = createAuthenticatedAPI({ baseUrl: BASE, getToken })
    const user = await api.getMe()

    expect(user).toEqual({ id: 1 })
    const [, opts] = fetchMock.mock.calls[0]
    expect(opts.headers.Authorization).toBeUndefined()
    expect(warn).toHaveBeenCalledWith('Failed to get auth token:', expect.any(Error))
  })

  it('force-refreshes the token and retries once on 401, then succeeds', async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse(401, { detail: 'expired' }))
      .mockResolvedValueOnce(mockResponse(200, { id: 2 }))
    const getToken = vi
      .fn()
      .mockResolvedValueOnce('stale')
      .mockResolvedValueOnce('fresh')
    const onAuthFailure = vi.fn()

    const api = createAuthenticatedAPI({ baseUrl: BASE, getToken, onAuthFailure })
    const user = await api.getMe()

    expect(user).toEqual({ id: 2 })
    expect(getToken).toHaveBeenCalledTimes(2)
    expect(getToken).toHaveBeenNthCalledWith(2, { skipCache: true })
    expect(onAuthFailure).not.toHaveBeenCalled()
    // The retry carried the refreshed token.
    const [, retryOpts] = fetchMock.mock.calls[1]
    expect(retryOpts.headers.Authorization).toBe('Bearer fresh')
  })

  it('calls onAuthFailure and throws when the retry also 401s', async () => {
    fetchMock.mockResolvedValue(mockResponse(401, { detail: 'nope' }))
    const getToken = vi.fn().mockResolvedValue('tok')
    const onAuthFailure = vi.fn()

    const api = createAuthenticatedAPI({ baseUrl: BASE, getToken, onAuthFailure })

    await expect(api.getMe()).rejects.toBeInstanceOf(APIError)
    expect(onAuthFailure).toHaveBeenCalledOnce()
    expect(getToken).toHaveBeenCalledTimes(2)
  })

  it('reuses the request body when retrying a mutation after 401', async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse(401, {}))
      .mockResolvedValueOnce(mockResponse(200, { ok: true }))
    const getToken = vi.fn().mockResolvedValue('tok')

    const api = createAuthenticatedAPI({ baseUrl: BASE, getToken })
    await api.updateSettings({})

    const [, first] = fetchMock.mock.calls[0]
    const [, retry] = fetchMock.mock.calls[1]
    expect(first.method).toBe('PATCH')
    expect(retry.method).toBe('PATCH')
    // Body is a string, so it survives the retry unchanged (no consumed stream).
    expect(retry.body).toBe(first.body)
  })

  it('does not retry non-401 errors', async () => {
    fetchMock.mockResolvedValue(mockResponse(500, { detail: 'server error' }))
    const getToken = vi.fn().mockResolvedValue('tok')
    const onAuthFailure = vi.fn()

    const api = createAuthenticatedAPI({ baseUrl: BASE, getToken, onAuthFailure })

    await expect(api.getMe()).rejects.toBeInstanceOf(APIError)
    expect(getToken).toHaveBeenCalledTimes(1) // no retry
    expect(onAuthFailure).not.toHaveBeenCalled()
  })
})
