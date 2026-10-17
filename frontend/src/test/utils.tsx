import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'motion/react'
import { Toaster } from 'sonner'
import { vi } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { resetCsrfToken } from '@/lib/api'
import type { Booking, PublicConfig, RoomDetail, User } from '@/types/api'

type Handler = (body: unknown, url: URL, init: RequestInit) => { status?: number; body?: unknown } | Promise<{ status?: number; body?: unknown }>

export interface FetchMock {
  calls: { method: string; path: string; body: unknown; headers: Record<string, string> }[]
}

/**
 * Installs a fetch mock that routes "METHOD /path" to handlers. Unknown routes fail loudly so tests never
 * silently depend on missing data.
 */
export function mockApi(routes: Record<string, Handler | { status?: number; body?: unknown }>): FetchMock {
  resetCsrfToken()
  const state: FetchMock = { calls: [] }
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.toString(), 'http://localhost')
    const method = (init.method ?? 'GET').toUpperCase()
    const body = init.body && typeof init.body === 'string' ? JSON.parse(init.body) : init.body
    state.calls.push({ method, path: url.pathname, body, headers: (init.headers ?? {}) as Record<string, string> })
    const key = `${method} ${url.pathname}`
    const route = routes[key] ?? (key === 'GET /api/auth/csrf' ? { body: { headerName: 'X-XSRF-TOKEN', token: 'test-csrf-token' } } : undefined)
    if (!route) throw new Error(`Unexpected request: ${key}`)
    const result = typeof route === 'function' ? await route(body, url, init) : route
    const status = result.status ?? 200
    return new Response(status === 204 ? null : JSON.stringify(result.body ?? null), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  vi.stubGlobal('fetch', fetchMock)
  return state
}

export function renderApp(ui: ReactElement, { route = '/', path = '*' }: { route?: string; path?: string } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MotionConfig reducedMotion="always">
        <MemoryRouter initialEntries={[route]}>
          <AuthProvider>
            <Routes>
              <Route path={path} element={ui} />
              <Route path="*" element={<div data-testid="other-route" />} />
            </Routes>
            <Toaster />
          </AuthProvider>
        </MemoryRouter>
      </MotionConfig>
    </QueryClientProvider>,
  )
}

// ---- Fixtures -------------------------------------------------------------------------------

export const student: User = {
  id: 7,
  fullName: 'Asha Learner',
  email: 'asha@example.test',
  role: 'STUDENT',
  accountStatus: 'ACTIVE',
  createdAt: '2026-10-01T05:00:00Z',
}

export const config: PublicConfig = {
  timeZone: 'Asia/Kolkata',
  today: '2031-03-03',
  serverTime: '2031-03-03T08:00:00',
  slotDurationMinutes: 60,
  minDurationMinutes: 60,
  maxDurationMinutes: 180,
  advanceBookingDays: 14,
  cancellationDeadlineMinutes: 60,
  maxActiveBookingsPerUser: 5,
  pricingEnabled: false,
  passwordResetEmailEnabled: false,
  defaultHours: [1, 2, 3, 4, 5, 6, 7].map((d) => ({
    dayOfWeek: d,
    dayName: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][d - 1],
    closed: false,
    openTime: '09:00:00',
    closeTime: '21:00:00',
  })),
}

export const room: RoomDetail = {
  id: 2,
  roomNumber: 'G-102',
  name: 'The Hive Room',
  description: 'Our signature group room.',
  location: 'Ground floor',
  minimumCapacity: 3,
  maximumCapacity: 8,
  status: 'ACTIVE',
  images: [],
  amenities: [{ id: 1, code: 'wifi', name: 'Wi-Fi', category: 'FACILITY' }],
  weeklyHours: config.defaultHours,
  rules: {
    slotDurationMinutes: 60,
    minDurationMinutes: 60,
    maxDurationMinutes: 180,
    advanceBookingDays: 14,
    cancellationDeadlineMinutes: 60,
    maxActiveBookingsPerUser: 5,
    pricingEnabled: false,
    timeZone: 'Asia/Kolkata',
  },
}

export function availability(booked: string[] = []) {
  return {
    roomId: 2,
    date: '2031-03-04',
    roomActive: true,
    open: true,
    openTime: '09:00:00',
    closeTime: '13:00:00',
    slotDurationMinutes: 60,
    slots: ['09', '10', '11', '12'].map((h) => ({
      start: `2031-03-04T${h}:00:00`,
      end: `2031-03-04T${String(Number(h) + 1).padStart(2, '0')}:00:00`,
      status: booked.includes(h) ? 'BOOKED' : 'AVAILABLE',
    })),
  }
}

export function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 11,
    bookingReference: 'SH-7KQ3PA',
    status: 'CONFIRMED',
    room: { id: 2, roomNumber: 'G-102', name: 'The Hive Room', location: 'Ground floor' },
    startTime: '2031-03-04T10:00:00',
    endTime: '2031-03-04T12:00:00',
    startsAt: '2031-03-04T04:30:00Z',
    endsAt: '2031-03-04T06:30:00Z',
    groupName: 'Thermo circle',
    groupSize: 6,
    createdAt: '2031-03-01T04:30:00Z',
    cancellable: true,
    cancellationDeadline: '2031-03-04T09:00:00',
    ...overrides,
  }
}
