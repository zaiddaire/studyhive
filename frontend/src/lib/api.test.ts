import { describe, expect, it } from 'vitest'
import { ApiError, apiRequest, buildQuery, retryDelay, shouldRetry } from './api'
import { mockApi } from '@/test/utils'

describe('apiRequest', () => {
  it('sends the CSRF token on state-changing requests but not on reads', async () => {
    const api = mockApi({
      'GET /api/rooms': { body: { ok: true } },
      'POST /api/bookings': { status: 201, body: { id: 1 } },
    })
    await apiRequest('/api/rooms')
    await apiRequest('/api/bookings', { method: 'POST', body: { roomId: 1 }, idempotencyKey: 'key-12345678' })

    const get = api.calls.find((c) => c.path === '/api/rooms')!
    const post = api.calls.find((c) => c.path === '/api/bookings')!
    expect(get.headers['X-XSRF-TOKEN']).toBeUndefined()
    expect(post.headers['X-XSRF-TOKEN']).toBe('test-csrf-token')
    expect(post.headers['Idempotency-Key']).toBe('key-12345678')
  })

  it('refreshes an expired CSRF token and retries once', async () => {
    let attempts = 0
    const api = mockApi({
      'POST /api/auth/logout': () => {
        attempts++
        return attempts === 1 ? { status: 403, body: { code: 'CSRF_INVALID', message: 'expired' } } : { status: 204 }
      },
    })
    await apiRequest('/api/auth/logout', { method: 'POST' })
    expect(attempts).toBe(2)
    expect(api.calls.filter((c) => c.path === '/api/auth/csrf')).toHaveLength(2)
  })

  it('turns server errors into ApiError with field errors', async () => {
    mockApi({
      'POST /api/auth/register': {
        status: 409,
        body: { code: 'EMAIL_TAKEN', message: 'An account with this email already exists.', fieldErrors: [{ field: 'email', message: 'taken' }] },
      },
    })
    const error = (await apiRequest('/api/auth/register', { method: 'POST', body: {} }).catch((e) => e)) as ApiError
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(409)
    expect(error.code).toBe('EMAIL_TAKEN')
    expect(error.fieldErrors[0].field).toBe('email')
  })

  it('reports network failures in plain language', async () => {
    mockApi({
      'GET /api/rooms': () => {
        throw new TypeError('Failed to fetch')
      },
    })
    const error = (await apiRequest('/api/rooms').catch((e) => e)) as ApiError
    expect(error).toBeInstanceOf(ApiError)
    expect(error.isNetworkError).toBe(true)
    expect(error.message).toMatch(/check your internet connection/i)
  })

  it('builds query strings without empty values', () => {
    expect(buildQuery({ q: '', page: 0, amenities: ['wifi', 'ac'], date: undefined })).toBe('?page=0&amenities=wifi&amenities=ac')
  })

  it('waits patiently for a sleeping free-tier server but never retries client errors', () => {
    const waking = new ApiError(503, 'HTTP_503', 'unavailable')
    const offline = new ApiError(0, 'NETWORK_ERROR', 'offline')
    expect(shouldRetry(5, waking)).toBe(true)
    expect(shouldRetry(5, offline)).toBe(true)
    expect(shouldRetry(10, waking)).toBe(false)
    expect(retryDelay(1, waking)).toBe(4000)
    expect(shouldRetry(0, new ApiError(404, 'NOT_FOUND', 'missing'))).toBe(false)
    expect(shouldRetry(1, new ApiError(500, 'INTERNAL_ERROR', 'boom'))).toBe(true)
    expect(shouldRetry(2, new ApiError(500, 'INTERNAL_ERROR', 'boom'))).toBe(false)
  })
})
