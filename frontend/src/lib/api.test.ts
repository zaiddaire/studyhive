import { afterEach, describe, expect, it } from 'vitest'
import { ApiError, apiRequest, buildQuery, markLastApiContact, onServerWaking, setWakeTiming, shouldRetry } from './api'
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
})

describe('cold starts on free hosting', () => {
  afterEach(() => setWakeTiming({ budgetMs: 0, retryMs: 4000, slowMs: 6000, idleMs: 600_000 }))

  const fast = () => setWakeTiming({ budgetMs: 2000, retryMs: 5, slowMs: 1000, idleMs: 600_000 })

  it('keeps retrying a GET through 503s while the server boots, and reports waking', async () => {
    fast()
    let attempts = 0
    mockApi({
      'GET /api/rooms': () => (++attempts < 3 ? { status: 503, body: { message: 'booting' } } : { body: { ok: true } }),
    })
    const states: boolean[] = []
    const stop = onServerWaking((w) => states.push(w))
    await expect(apiRequest('/api/rooms')).resolves.toEqual({ ok: true })
    stop()
    expect(attempts).toBe(3)
    expect(states).toEqual([false, true, false])
  })

  it('also waits through dropped connections', async () => {
    fast()
    let attempts = 0
    mockApi({
      'GET /api/config': () => {
        if (++attempts < 2) throw new TypeError('Failed to fetch')
        return { body: { today: '2031-03-03' } }
      },
    })
    await expect(apiRequest('/api/config')).resolves.toEqual({ today: '2031-03-03' })
    expect(attempts).toBe(2)
  })

  it('never blindly retries a state-changing request', async () => {
    fast()
    markLastApiContact(Date.now())
    let attempts = 0
    mockApi({ 'POST /api/bookings': () => (attempts++, { status: 503, body: {} }) })
    const error = (await apiRequest('/api/bookings', { method: 'POST', body: {} }).catch((e) => e)) as ApiError
    expect(attempts).toBe(1)
    expect(error.status).toBe(503)
    expect(error.message).toMatch(/waking up/i)
  })

  it('wakes a server that has been idle before sending a login', async () => {
    fast()
    markLastApiContact(Date.now() - 30 * 60_000) // quiet for 30 minutes: the free server is asleep
    let csrfAttempts = 0
    const api = mockApi({
      'GET /api/auth/csrf': () => (++csrfAttempts < 3 ? { status: 502 } : { body: { headerName: 'X-XSRF-TOKEN', token: 'fresh-token' } }),
      'POST /api/auth/login': { body: { id: 1 } },
    })
    await expect(apiRequest('/api/auth/login', { method: 'POST', body: { email: 'a@b.test', password: 'x' } })).resolves.toEqual({ id: 1 })
    expect(csrfAttempts).toBe(3)
    const login = api.calls.find((c) => c.path === '/api/auth/login')!
    expect(login.headers['X-XSRF-TOKEN']).toBe('fresh-token')
  })

  it('shows the waking notice while a request is held open, and clears it when answered', async () => {
    setWakeTiming({ budgetMs: 2000, retryMs: 5, slowMs: 20, idleMs: 600_000 })
    mockApi({ 'GET /api/rooms': () => new Promise((resolve) => setTimeout(() => resolve({ body: [] }), 80)) })
    const states: boolean[] = []
    const stop = onServerWaking((w) => states.push(w))
    await apiRequest('/api/rooms')
    stop()
    expect(states).toEqual([false, true, false])
  })

  it('does not stack query retries on top of the cold-start wait', () => {
    expect(shouldRetry(0, new ApiError(503, 'HTTP_503', 'waking'))).toBe(false)
    expect(shouldRetry(0, new ApiError(0, 'NETWORK_ERROR', 'offline'))).toBe(false)
    expect(shouldRetry(0, new ApiError(404, 'NOT_FOUND', 'missing'))).toBe(false)
    expect(shouldRetry(1, new ApiError(500, 'INTERNAL_ERROR', 'boom'))).toBe(true)
    expect(shouldRetry(2, new ApiError(500, 'INTERNAL_ERROR', 'boom'))).toBe(false)
  })
})
