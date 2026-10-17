/**
 * Booking times from the API are facility-local wall-clock values ("2031-03-04T10:00:00") in the server's
 * configured time zone. They are displayed exactly as given - never converted to the browser's zone - by
 * formatting them as if they were UTC. Absolute instants (startsAt) are used only for countdowns.
 */
import type { IsoDate, LocalDateTime, LocalTime } from '@/types/api'

const LOCALE = 'en-GB'

function parts(value: LocalDateTime) {
  const [date, time = '00:00'] = value.split('T')
  return { date, time: time.slice(0, 5) }
}

export function datePart(value: LocalDateTime): IsoDate {
  return parts(value).date
}

export function timePart(value: LocalDateTime | LocalTime): string {
  return value.includes('T') ? parts(value).time : value.slice(0, 5)
}

function utcDate(date: IsoDate, time = '00:00'): Date {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  return new Date(Date.UTC(y, m - 1, d, hh, mm))
}

export function formatDate(date: IsoDate, style: 'long' | 'medium' | 'short' = 'medium'): string {
  const options: Intl.DateTimeFormatOptions =
    style === 'long'
      ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
      : style === 'medium'
        ? { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }
        : { weekday: 'short', day: 'numeric', month: 'short' }
  return new Intl.DateTimeFormat(LOCALE, { ...options, timeZone: 'UTC' }).format(utcDate(date))
}

export function formatDayNumber(date: IsoDate): { weekday: string; day: string; month: string } {
  const d = utcDate(date)
  return {
    weekday: new Intl.DateTimeFormat(LOCALE, { weekday: 'short', timeZone: 'UTC' }).format(d),
    day: new Intl.DateTimeFormat(LOCALE, { day: 'numeric', timeZone: 'UTC' }).format(d),
    month: new Intl.DateTimeFormat(LOCALE, { month: 'short', timeZone: 'UTC' }).format(d),
  }
}

export function formatTimeRange(start: LocalDateTime, end: LocalDateTime): string {
  return `${timePart(start)}–${timePart(end)}`
}

export function formatDateTime(value: LocalDateTime): string {
  const { date, time } = parts(value)
  return `${formatDate(date, 'short')}, ${time}`
}

/** Formats an absolute ISO instant (audit timestamps) in the facility zone. */
export function formatInstant(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(new Date(value))
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const d = utcDate(date)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function isoDayOfWeek(date: IsoDate): number {
  const day = utcDate(date).getUTCDay()
  return day === 0 ? 7 : day
}

/** A Date for react-day-picker representing the given calendar date (local midnight). */
export function toPickerDate(date: IsoDate): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function fromPickerDate(date: Date): IsoDate {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function minutesOf(time: LocalTime): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export function timeFromMinutes(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function combine(date: IsoDate, time: string): LocalDateTime {
  return `${date}T${time.slice(0, 5)}:00`
}

export function durationMinutes(start: LocalDateTime, end: LocalDateTime): number {
  return minutesOf(timePart(end)) - minutesOf(timePart(start)) + (datePart(end) === datePart(start) ? 0 : 24 * 60)
}

export function formatDuration(minutes: number): string {
  if (minutes % 60 === 0) {
    const h = minutes / 60
    return `${h} ${h === 1 ? 'hour' : 'hours'}`
  }
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`
}

function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((utcDate(to).getTime() - utcDate(from).getTime()) / 86_400_000)
}

/**
 * Human "when" for a booking. Sessions on a later facility-calendar day are described by calendar days
 * ("tomorrow", "in 3 days") - not by elapsed hours, which would call Monday morning "tomorrow" on a
 * Saturday evening. Same-day sessions get an hours/minutes countdown from the absolute start instant.
 */
export function countdown(startsAtIso: string, now: number, sessionDate: IsoDate, today: IsoDate): string {
  const days = daysBetween(today, sessionDate)
  if (days === 1) return 'tomorrow'
  if (days > 1) return `in ${days} days`
  const diff = new Date(startsAtIso).getTime() - now
  if (diff <= 0) return 'now'
  const minutes = Math.round(diff / 60000)
  if (minutes < 60) return `in ${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `in ${hours} h ${rest} min` : `in ${hours} h`
}

export function greeting(date = new Date()): string {
  const h = date.getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}
