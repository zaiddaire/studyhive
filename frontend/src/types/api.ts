/** Types mirroring the Spring Boot DTOs. Date-times without offset are facility-local wall-clock values. */

export type Role = 'STUDENT' | 'ADMIN'
export type AccountStatus = 'ACTIVE' | 'SUSPENDED'
export type RoomStatus = 'ACTIVE' | 'INACTIVE'
export type AmenityCategory = 'FACILITY' | 'EQUIPMENT' | 'ACCESSIBILITY'
export type BookingStatus = 'CONFIRMED' | 'CANCELLED' | 'COMPLETED'
export type SlotStatus = 'AVAILABLE' | 'BOOKED' | 'BLOCKED' | 'PAST' | 'OUTSIDE_WINDOW' | 'CLOSED'
export type BookingEventType = 'CREATED' | 'CANCELLED_BY_STUDENT' | 'CANCELLED_BY_ADMIN' | 'COMPLETED'

/** "YYYY-MM-DD" */
export type IsoDate = string
/** "YYYY-MM-DDTHH:mm[:ss]" facility-local */
export type LocalDateTime = string
/** "HH:mm[:ss]" */
export type LocalTime = string

export interface PageResponse<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export interface User {
  id: number
  fullName: string
  email: string
  role: Role
  accountStatus: AccountStatus
  createdAt: string
}

export interface Amenity {
  id: number
  code: string
  name: string
  description?: string
  category: AmenityCategory
}

export interface RoomImage {
  url: string
  altText: string
}

export interface AvailabilitySummary {
  status: 'AVAILABLE' | 'UNAVAILABLE'
  message: string
  freeSlots?: number
  totalSlots?: number
}

export interface RoomSummary {
  id: number
  roomNumber: string
  name: string
  summary: string
  location?: string
  minimumCapacity: number
  maximumCapacity: number
  status: RoomStatus
  hourlyPrice?: number
  coverImage?: RoomImage
  amenities: Amenity[]
  availability?: AvailabilitySummary
}

export interface DayHours {
  dayOfWeek: number
  dayName: string
  closed: boolean
  openTime?: LocalTime
  closeTime?: LocalTime
}

export interface BookingRules {
  slotDurationMinutes: number
  minDurationMinutes: number
  maxDurationMinutes: number
  advanceBookingDays: number
  cancellationDeadlineMinutes: number
  maxActiveBookingsPerUser: number
  pricingEnabled: boolean
  timeZone: string
}

export interface RoomDetail {
  id: number
  roomNumber: string
  name: string
  description: string
  location?: string
  accessibilityInfo?: string
  minimumCapacity: number
  maximumCapacity: number
  status: RoomStatus
  hourlyPrice?: number
  images: RoomImage[]
  amenities: Amenity[]
  weeklyHours: DayHours[]
  rules: BookingRules
}

export interface Slot {
  start: LocalDateTime
  end: LocalDateTime
  status: SlotStatus
}

export interface DayAvailability {
  roomId: number
  date: IsoDate
  roomActive: boolean
  open: boolean
  openTime?: LocalTime
  closeTime?: LocalTime
  message?: string
  slotDurationMinutes: number
  slots: Slot[]
}

export interface PublicConfig {
  timeZone: string
  today: IsoDate
  serverTime: LocalDateTime
  slotDurationMinutes: number
  minDurationMinutes: number
  maxDurationMinutes: number
  advanceBookingDays: number
  cancellationDeadlineMinutes: number
  maxActiveBookingsPerUser: number
  pricingEnabled: boolean
  passwordResetEmailEnabled: boolean
  defaultHours: DayHours[]
}

export interface BookingRoomInfo {
  id: number
  roomNumber: string
  name: string
  location?: string
  coverImage?: RoomImage
}

export interface BookingEvent {
  type: BookingEventType
  actorName?: string
  details?: string
  createdAt: string
}

export interface Booking {
  id: number
  bookingReference: string
  status: BookingStatus
  room: BookingRoomInfo
  startTime: LocalDateTime
  endTime: LocalDateTime
  startsAt: string
  endsAt: string
  groupName?: string
  groupSize: number
  purpose?: string
  totalPrice?: number
  cancellationReason?: string
  cancelledAt?: string
  cancelledByAdmin?: boolean
  createdAt: string
  cancellable: boolean
  cancellationDeadline?: LocalDateTime
  owner?: { id: number; fullName: string; email: string }
  history?: BookingEvent[]
}

export interface BookingSummary {
  upcomingCount: number
  pastCount: number
  cancelledCount: number
  nextBooking?: Booking
}

export interface CreateBookingInput {
  roomId: number
  startTime: LocalDateTime
  endTime: LocalDateTime
  groupName?: string
  groupSize: number
  purpose?: string
}

// ---- Admin ---------------------------------------------------------------------------------

export interface AdminRoom {
  id: number
  roomNumber: string
  name: string
  description: string
  location?: string
  accessibilityInfo?: string
  minimumCapacity: number
  maximumCapacity: number
  status: RoomStatus
  hourlyPrice?: number
  images: RoomImage[]
  amenities: Amenity[]
  customHours: boolean
  upcomingBookings: number
  createdAt: string
  updatedAt: string
}

export interface RoomInput {
  roomNumber: string
  name: string
  description: string
  location?: string
  accessibilityInfo?: string
  minimumCapacity: number
  maximumCapacity: number
  hourlyPrice?: number | null
  status: RoomStatus
  amenityIds: number[]
  images: RoomImage[]
}

export interface RoomStatusResult {
  room: AdminRoom
  futureBookings: number
  cancelledBookings: number
}

export interface BookingSettings {
  slotDurationMinutes: number
  minDurationMinutes: number
  maxDurationMinutes: number
  advanceBookingDays: number
  cancellationDeadlineMinutes: number
  maxActiveBookingsPerUser: number
  pricingEnabled: boolean
  updatedAt?: string
}

export interface DayHoursInput {
  dayOfWeek: number
  closed: boolean
  openTime?: string | null
  closeTime?: string | null
}

export interface RoomHours {
  usesDefault: boolean
  days: DayHours[]
}

export interface BlockedPeriod {
  id: number
  roomId?: number
  roomNumber?: string
  roomName?: string
  startTime: LocalDateTime
  endTime: LocalDateTime
  reason: string
  createdByName?: string
  createdAt: string
}

export interface BlockedPeriodInput {
  roomId: number | null
  startTime: LocalDateTime
  endTime: LocalDateTime
  reason: string
  cancelAffectedBookings: boolean
}

export interface BlockedPeriodCreated {
  block: BlockedPeriod
  affectedBookings: Booking[]
  cancelledCount: number
}

export interface AdminUser {
  id: number
  fullName: string
  email: string
  role: Role
  accountStatus: AccountStatus
  createdAt: string
  totalBookings: number
}

export interface RoomUtilization {
  roomId: number
  roomNumber: string
  name: string
  bookedHours: number
  openHours: number
  percent?: number
}

export interface Stats {
  totalRooms: number
  activeRooms: number
  totalStudents: number
  reservationsToday: number
  upcomingReservations: number
  cancelledReservations: number
  completedReservations: number
  utilizationPercent?: number
  utilizationWindowDays: number
  roomUtilization: RoomUtilization[]
  next7Days: { date: IsoDate; bookings: number }[]
  recentActivity: {
    type: BookingEventType
    bookingId: number
    bookingReference: string
    roomName: string
    actorName?: string
    details?: string
    createdAt: string
  }[]
}
