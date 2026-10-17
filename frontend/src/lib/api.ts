/**
 * Fetch wrapper for the StudyHive API.
 *
 * - Authentication is an HTTP-only session cookie (credentials: 'include'); no tokens are stored in JS storage.
 * - State-changing requests send the CSRF token in X-XSRF-TOKEN. The token is fetched from /api/auth/csrf and
 *   kept in memory; if the server reports it as invalid/expired the request is retried once with a fresh token.
 * - Failures become ApiError with the server's safe message and field errors, or a friendly network message.
 */

const RAW_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''
export const API_BASE = RAW_BASE.replace(/\/+$/, '')

export interface FieldError {
  field: string
  message: string
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly fieldErrors: FieldError[]
  readonly errorId?: string

  constructor(status: number, code: string, message: string, fieldErrors: FieldError[] = [], errorId?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fieldErrors = fieldErrors
    this.errorId = errorId
  }

  get isNetworkError() {
    return this.status === 0
  }
}

let csrfToken: string | null = null
let csrfRequest: Promise<string> | null = null

// ---- Cold starts on free hosting ----------------------------------------------------------------
// The free API host sleeps after ~15 idle minutes and takes 1-3 minutes to boot. While it boots the
// proxy either holds the request open or answers 502/503/504 (or the connection fails). Read requests
// wait it out instead of failing, a "waking up" notice is shown, and state-changing requests first wake
// the server with a GET so they never hit a sleeping instance.

const wakeTiming = {
  /** Total time a GET keeps retrying through a cold start. */
  budgetMs: import.meta.env.MODE === 'test' ? 0 : 200_000,
  /** Pause between attempts. */
  retryMs: 4_000,
  /** A request still unanswered after this long is treated as "the server is waking up". */
  slowMs: 6_000,
  /** After this much silence the server may be asleep, so mutations wake it first. */
  idleMs: 10 * 60_000,
}

/** Test hook: shorten or disable the cold-start waits. */
export function setWakeTiming(timing: Partial<typeof wakeTiming>) {
  Object.assign(wakeTiming, timing)
}

const wakeListeners = new Set<(waking: boolean) => void>()
let waking = false
let lastContactAt = 0

function setWaking(value: boolean) {
  if (waking === value) return
  waking = value
  wakeListeners.forEach((listener) => listener(value))
}

/** Subscribe to "the server is waking up" changes; returns an unsubscribe function. */
export function onServerWaking(listener: (waking: boolean) => void): () => void {
  wakeListeners.add(listener)
  listener(waking)
  return () => {
    wakeListeners.delete(listener)
  }
}

/** Test hook: pretend the last successful contact with the API happened at this time. */
export function markLastApiContact(at: number) {
  lastContactAt = at
}

function sleep(ms: number, signal?: AbortSignal | null) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    })
  })
}

const isColdStartStatus = (status: number) => status === 502 || status === 503 || status === 504

/** fetch that waits through an API cold start. Only idempotent requests are retried. */
async function fetchWaking(url: string, init: RequestInit, retryable: boolean): Promise<Response> {
  const started = Date.now()
  for (;;) {
    const slowTimer = setTimeout(() => setWaking(true), wakeTiming.slowMs)
    try {
      const response = await fetch(url, init)
      clearTimeout(slowTimer)
      const withinBudget = Date.now() - started < wakeTiming.budgetMs
      if (!(retryable && isColdStartStatus(response.status) && withinBudget)) {
        if (!isColdStartStatus(response.status)) {
          lastContactAt = Date.now()
          setWaking(false)
        }
        return response
      }
    } catch (error) {
      clearTimeout(slowTimer)
      const aborted = error instanceof DOMException && error.name === 'AbortError'
      if (aborted || !retryable || Date.now() - started >= wakeTiming.budgetMs) {
        if (!aborted) setWaking(false)
        throw error
      }
    }
    setWaking(true)
    await sleep(wakeTiming.retryMs, init.signal)
  }
}

async function fetchCsrfToken(): Promise<string> {
  let response: Response
  try {
    response = await fetchWaking(`${API_BASE}/api/auth/csrf`, { credentials: 'include', headers: { Accept: 'application/json' } }, true)
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', "We couldn't reach StudyHive. Check your internet connection and try again.")
  }
  if (!response.ok) {
    throw new ApiError(response.status, 'CSRF_UNAVAILABLE', 'Could not start a secure session. Please refresh the page.')
  }
  const body = (await response.json()) as { token: string }
  return body.token
}

async function getCsrfToken(forceRefresh = false): Promise<string> {
  if (csrfToken && !forceRefresh) return csrfToken
  if (!csrfRequest) {
    csrfRequest = fetchCsrfToken()
      .then((token) => {
        csrfToken = token
        return token
      })
      .finally(() => {
        csrfRequest = null
      })
  }
  return csrfRequest
}

/** Call after login, registration and logout: the server rotates the CSRF token at those points. */
export function resetCsrfToken() {
  csrfToken = null
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: Record<string, string | number | boolean | string[] | undefined | null>
  idempotencyKey?: string
  signal?: AbortSignal
}

export function buildQuery(query?: RequestOptions['query']): string {
  if (!query) return ''
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) value.forEach((v) => params.append(key, v))
    else params.set(key, String(value))
  }
  const text = params.toString()
  return text ? `?${text}` : ''
}

async function toApiError(response: Response): Promise<ApiError> {
  let payload: Partial<{ code: string; message: string; fieldErrors: FieldError[]; errorId: string }> = {}
  try {
    payload = await response.json()
  } catch {
    // Non-JSON error (e.g. proxy HTML page)
  }
  const fallback =
    response.status === 401
      ? 'Please log in to continue.'
      : response.status === 403
        ? 'You do not have permission to do that.'
        : response.status === 404
          ? 'We could not find what you were looking for.'
          : isColdStartStatus(response.status)
            ? 'StudyHive is still waking up. Please try again in a minute.'
            : response.status >= 500
              ? 'StudyHive is having trouble right now. Please try again in a moment.'
            : 'Something went wrong. Please try again.'
  return new ApiError(
    response.status,
    payload.code ?? `HTTP_${response.status}`,
    payload.message ?? fallback,
    payload.fieldErrors ?? [],
    payload.errorId,
  )
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const method = options.method ?? 'GET'
  const headers: Record<string, string> = { Accept: 'application/json' }
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
  if (options.body !== undefined && !isFormData) headers['Content-Type'] = 'application/json'
  if (method !== 'GET') {
    // If the API has been quiet long enough to fall asleep, wake it with a (retried) GET first, so a
    // login or booking never times out against a sleeping server.
    const mayBeAsleep = Date.now() - lastContactAt > wakeTiming.idleMs
    headers['X-XSRF-TOKEN'] = await getCsrfToken(mayBeAsleep)
  }
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey

  let response: Response
  try {
    response = await fetchWaking(
      `${API_BASE}${path}${buildQuery(options.query)}`,
      {
        method,
        credentials: 'include',
        headers,
        signal: options.signal,
        body: options.body === undefined ? undefined : isFormData ? (options.body as FormData) : JSON.stringify(options.body),
      },
      method === 'GET',
    )
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(0, 'NETWORK_ERROR', "We couldn't reach StudyHive. Check your internet connection and try again.")
  }

  if (!response.ok) {
    const error = await toApiError(response)
    if (!isRetry && method !== 'GET' && error.code === 'CSRF_INVALID') {
      await getCsrfToken(true)
      return apiRequest<T>(path, options, true)
    }
    throw error
  }
  if (response.status === 204) return undefined as T
  const text = await response.text()
  return (text ? JSON.parse(text) : undefined) as T
}

export function isWakeUpError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 0 || isColdStartStatus(error.status))
}

/**
 * Query retry policy. Cold starts are already waited out inside fetchWaking, so they aren't retried again
 * here (that would double the wait). Client errors are never retried; other server errors retry briefly.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false
  if (isWakeUpError(error)) return false
  return failureCount < 2
}

export function retryDelay(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 8000)
}

/** Resolves relative asset URLs (uploaded images are served by the API) against the API base. */
export function assetUrl(url: string | undefined | null): string | undefined {
  if (!url) return undefined
  return url.startsWith('/') ? `${API_BASE}${url}` : url
}

/** Reads a field error from an ApiError, for wiring server-side validation into forms. */
export function fieldErrorsOf(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) return {}
  return Object.fromEntries(error.fieldErrors.map((f) => [f.field, f.message]))
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return 'Something went wrong. Please try again.'
}
