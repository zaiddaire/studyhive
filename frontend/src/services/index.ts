import { apiRequest } from '@/lib/api'
import type {
  AdminRoom,
  AdminUser,
  AccountStatus,
  Amenity,
  BlockedPeriod,
  BlockedPeriodCreated,
  BlockedPeriodInput,
  Booking,
  BookingSettings,
  BookingStatus,
  BookingSummary,
  CreateBookingInput,
  DayAvailability,
  DayHours,
  DayHoursInput,
  IsoDate,
  PageResponse,
  PublicConfig,
  RoomDetail,
  RoomHours,
  RoomInput,
  RoomStatus,
  RoomStatusResult,
  RoomSummary,
  Stats,
  User,
} from '@/types/api'

// ---- Query keys (one place, so invalidation stays consistent) ------------------------------------

export const queryKeys = {
  me: ['me'] as const,
  config: ['config'] as const,
  amenities: ['amenities'] as const,
  rooms: (params: RoomSearchParams) => ['rooms', params] as const,
  room: (id: number) => ['room', id] as const,
  availability: (id: number, date: IsoDate) => ['availability', id, date] as const,
  myBookings: (scope: string, page: number) => ['my-bookings', scope, page] as const,
  mySummary: ['my-bookings', 'summary'] as const,
  booking: (id: number) => ['booking', id] as const,
  admin: {
    stats: ['admin', 'stats'] as const,
    rooms: ['admin', 'rooms'] as const,
    room: (id: number) => ['admin', 'room', id] as const,
    roomHours: (id: number) => ['admin', 'room-hours', id] as const,
    bookings: (params: AdminBookingParams) => ['admin', 'bookings', params] as const,
    booking: (id: number) => ['admin', 'booking', id] as const,
    settings: ['admin', 'settings'] as const,
    hours: ['admin', 'hours'] as const,
    blocks: ['admin', 'blocks'] as const,
    users: (q: string, page: number) => ['admin', 'users', q, page] as const,
  },
}

// ---- Auth -------------------------------------------------------------------------------------

export const authApi = {
  me: () => apiRequest<User>('/api/auth/me'),
  login: (email: string, password: string) =>
    apiRequest<User>('/api/auth/login', { method: 'POST', body: { email, password } }),
  register: (body: { fullName: string; email: string; password: string; confirmPassword: string }) =>
    apiRequest<User>('/api/auth/register', { method: 'POST', body }),
  logout: () => apiRequest<void>('/api/auth/logout', { method: 'POST' }),
  updateProfile: (fullName: string) => apiRequest<User>('/api/auth/me', { method: 'PUT', body: { fullName } }),
  changePassword: (body: { currentPassword: string; newPassword: string; confirmPassword: string }) =>
    apiRequest<{ message: string }>('/api/auth/password/change', { method: 'POST', body }),
  forgotPassword: (email: string) =>
    apiRequest<{ message: string }>('/api/auth/password/forgot', { method: 'POST', body: { email } }),
  resetPassword: (body: { token: string; newPassword: string; confirmPassword: string }) =>
    apiRequest<{ message: string }>('/api/auth/password/reset', { method: 'POST', body }),
}

// ---- Public -----------------------------------------------------------------------------------

export interface RoomSearchParams {
  q?: string
  groupSize?: number
  amenities?: string[]
  date?: IsoDate
  startTime?: string
  duration?: number
  availableOnly?: boolean
  sort?: 'name' | 'capacity' | 'capacity_desc' | 'room_number'
  page?: number
  size?: number
}

export const publicApi = {
  config: () => apiRequest<PublicConfig>('/api/config'),
  amenities: () => apiRequest<Amenity[]>('/api/amenities'),
  rooms: (params: RoomSearchParams) =>
    apiRequest<PageResponse<RoomSummary>>('/api/rooms', {
      query: {
        q: params.q,
        groupSize: params.groupSize,
        amenities: params.amenities,
        date: params.date,
        startTime: params.startTime,
        duration: params.duration,
        availableOnly: params.availableOnly || undefined,
        sort: params.sort,
        page: params.page,
        size: params.size,
      },
    }),
  room: (id: number) => apiRequest<RoomDetail>(`/api/rooms/${id}`),
  availability: (id: number, date: IsoDate) =>
    apiRequest<DayAvailability>(`/api/rooms/${id}/availability`, { query: { date } }),
}

// ---- Student bookings -------------------------------------------------------------------------

export type BookingScope = 'upcoming' | 'past' | 'cancelled'

export const bookingsApi = {
  create: (input: CreateBookingInput, idempotencyKey: string) =>
    apiRequest<Booking>('/api/bookings', { method: 'POST', body: input, idempotencyKey }),
  mine: (scope: BookingScope, page = 0, size = 6) =>
    apiRequest<PageResponse<Booking>>('/api/bookings/my', { query: { scope, page, size } }),
  summary: () => apiRequest<BookingSummary>('/api/bookings/my/summary'),
  get: (id: number) => apiRequest<Booking>(`/api/bookings/${id}`),
  cancel: (id: number, reason?: string) =>
    apiRequest<Booking>(`/api/bookings/${id}/cancel`, { method: 'POST', body: { reason: reason || undefined } }),
}

// ---- Admin ------------------------------------------------------------------------------------

export interface AdminBookingParams {
  reference?: string
  roomId?: number
  status?: BookingStatus
  student?: string
  from?: IsoDate
  to?: IsoDate
  sort?: 'start_desc' | 'start_asc' | 'created_desc'
  page?: number
  size?: number
}

export const adminApi = {
  stats: () => apiRequest<Stats>('/api/admin/stats'),
  rooms: () => apiRequest<AdminRoom[]>('/api/admin/rooms'),
  room: (id: number) => apiRequest<AdminRoom>(`/api/admin/rooms/${id}`),
  createRoom: (body: RoomInput) => apiRequest<AdminRoom>('/api/admin/rooms', { method: 'POST', body }),
  updateRoom: (id: number, body: RoomInput) => apiRequest<AdminRoom>(`/api/admin/rooms/${id}`, { method: 'PUT', body }),
  setRoomStatus: (id: number, body: { status: RoomStatus; cancelFutureBookings: boolean; reason?: string }) =>
    apiRequest<RoomStatusResult>(`/api/admin/rooms/${id}/status`, { method: 'PATCH', body }),
  deleteRoom: (id: number) => apiRequest<void>(`/api/admin/rooms/${id}`, { method: 'DELETE' }),
  roomHours: (id: number) => apiRequest<RoomHours>(`/api/admin/rooms/${id}/hours`),
  updateRoomHours: (id: number, body: { useDefault: boolean; days?: DayHoursInput[] }) =>
    apiRequest<RoomHours>(`/api/admin/rooms/${id}/hours`, { method: 'PUT', body }),
  uploadImage: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return apiRequest<{ id: string; url: string }>('/api/admin/uploads/images', { method: 'POST', body: form })
  },
  bookings: (params: AdminBookingParams) =>
    apiRequest<PageResponse<Booking>>('/api/admin/bookings', { query: { ...params } }),
  booking: (id: number) => apiRequest<Booking>(`/api/admin/bookings/${id}`),
  cancelBooking: (id: number, reason: string) =>
    apiRequest<Booking>(`/api/admin/bookings/${id}/cancel`, { method: 'POST', body: { reason } }),
  settings: () => apiRequest<BookingSettings>('/api/admin/schedule/settings'),
  updateSettings: (body: BookingSettings) =>
    apiRequest<BookingSettings>('/api/admin/schedule/settings', { method: 'PUT', body }),
  hours: () => apiRequest<DayHours[]>('/api/admin/schedule/hours'),
  updateHours: (days: DayHoursInput[]) =>
    apiRequest<DayHours[]>('/api/admin/schedule/hours', { method: 'PUT', body: { days } }),
  blocks: () => apiRequest<BlockedPeriod[]>('/api/admin/schedule/blocks'),
  createBlock: (body: BlockedPeriodInput) =>
    apiRequest<BlockedPeriodCreated>('/api/admin/schedule/blocks', { method: 'POST', body }),
  deleteBlock: (id: number) => apiRequest<void>(`/api/admin/schedule/blocks/${id}`, { method: 'DELETE' }),
  users: (q: string, page: number) =>
    apiRequest<PageResponse<AdminUser>>('/api/admin/users', { query: { q, page, size: 20 } }),
  setUserStatus: (id: number, status: AccountStatus) =>
    apiRequest<AdminUser>(`/api/admin/users/${id}/status`, { method: 'PATCH', body: { status } }),
}
