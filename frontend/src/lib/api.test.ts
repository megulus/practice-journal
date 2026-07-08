import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createAuthenticatedAPI, APIError } from './api'

function mockResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
}

type FetchMock = ReturnType<typeof vi.fn>

describe('createAuthenticatedAPI — auth + 401 retry', () => {
  beforeEach(() => {
    global.fetch = vi.fn() as unknown as typeof fetch
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sends the bearer token and returns parsed JSON', async () => {
    ;(global.fetch as FetchMock).mockResolvedValue(mockResponse(200, { id: 1 }))
    const getToken = vi.fn().mockResolvedValue('tok')

    const api = createAuthenticatedAPI(getToken)
    const user = await api.getMe()

    expect(user).toEqual({ id: 1 })
    expect(getToken).toHaveBeenCalledTimes(1)
    expect(getToken).toHaveBeenCalledWith(undefined) // no skipCache on first try
    const [, opts] = (global.fetch as FetchMock).mock.calls[0]
    expect(opts.headers.Authorization).toBe('Bearer tok')
  })

  it('force-refreshes the token and retries once on 401, then succeeds', async () => {
    ;(global.fetch as FetchMock)
      .mockResolvedValueOnce(mockResponse(401, { detail: 'expired' }))
      .mockResolvedValueOnce(mockResponse(200, { id: 2 }))
    const getToken = vi
      .fn()
      .mockResolvedValueOnce('stale')
      .mockResolvedValueOnce('fresh')
    const onAuthFailure = vi.fn()

    const api = createAuthenticatedAPI(getToken, onAuthFailure)
    const user = await api.getMe()

    expect(user).toEqual({ id: 2 })
    expect(getToken).toHaveBeenCalledTimes(2)
    expect(getToken).toHaveBeenNthCalledWith(2, { skipCache: true })
    expect(onAuthFailure).not.toHaveBeenCalled()
    // The retry carried the refreshed token.
    const [, retryOpts] = (global.fetch as FetchMock).mock.calls[1]
    expect(retryOpts.headers.Authorization).toBe('Bearer fresh')
  })

  it('calls onAuthFailure and throws when the retry also 401s', async () => {
    ;(global.fetch as FetchMock).mockResolvedValue(
      mockResponse(401, { detail: 'nope' })
    )
    const getToken = vi.fn().mockResolvedValue('tok')
    const onAuthFailure = vi.fn()

    const api = createAuthenticatedAPI(getToken, onAuthFailure)

    await expect(api.getMe()).rejects.toBeInstanceOf(APIError)
    expect(onAuthFailure).toHaveBeenCalledOnce()
    expect(getToken).toHaveBeenCalledTimes(2)
  })

  it('does not retry non-401 errors', async () => {
    ;(global.fetch as FetchMock).mockResolvedValue(
      mockResponse(500, { detail: 'server error' })
    )
    const getToken = vi.fn().mockResolvedValue('tok')
    const onAuthFailure = vi.fn()

    const api = createAuthenticatedAPI(getToken, onAuthFailure)

    await expect(api.getMe()).rejects.toBeInstanceOf(APIError)
    expect(getToken).toHaveBeenCalledTimes(1) // no retry
    expect(onAuthFailure).not.toHaveBeenCalled()
  })
})
