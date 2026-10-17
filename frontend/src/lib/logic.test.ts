import { describe, expect, it } from 'vitest'
import { addDays, countdown, formatDuration, formatTimeRange, isoDayOfWeek, timePart } from './time'
import { durationOptions, extendSelection, startTimeOptions } from './booking'
import { bookingToIcs } from './utils'
import type { Slot } from '@/types/api'
import { booking } from '@/test/utils'

const slots = (statuses: Slot['status'][]): Slot[] =>
  statuses.map((status, i) => ({
    start: `2031-03-04T${String(9 + i).padStart(2, '0')}:00:00`,
    end: `2031-03-04T${String(10 + i).padStart(2, '0')}:00:00`,
    status,
  }))

describe('time helpers', () => {
  it('shows facility wall-clock times without time-zone conversion', () => {
    expect(timePart('2031-03-04T10:00:00')).toBe('10:00')
    expect(formatTimeRange('2031-03-04T10:00:00', '2031-03-04T12:30:00')).toBe('10:00–12:30')
  })

  it('does date arithmetic on calendar dates', () => {
    expect(addDays('2031-02-27', 2)).toBe('2031-03-01')
    expect(isoDayOfWeek('2031-03-03')).toBe(1) // Monday
    expect(isoDayOfWeek('2031-03-09')).toBe(7) // Sunday
  })

  it('describes upcoming sessions by calendar day, not elapsed hours', () => {
    const saturdayEvening = Date.parse('2026-10-17T12:30:00Z') // 18:00 IST
    // Monday 10:00 IST is ~40 hours away but two calendar days later.
    expect(countdown('2026-10-19T04:30:00Z', saturdayEvening, '2026-10-19', '2026-10-17')).toBe('in 2 days')
    expect(countdown('2026-10-18T04:30:00Z', saturdayEvening, '2026-10-18', '2026-10-17')).toBe('tomorrow')
    expect(countdown('2026-10-17T14:00:00Z', saturdayEvening, '2026-10-17', '2026-10-17')).toBe('in 1 h 30 min')
    expect(countdown('2026-10-17T12:00:00Z', saturdayEvening, '2026-10-17', '2026-10-17')).toBe('now')
  })

  it('formats durations', () => {
    expect(formatDuration(60)).toBe('1 hour')
    expect(formatDuration(180)).toBe('3 hours')
    expect(formatDuration(90)).toBe('1 h 30 min')
  })
})

describe('booking helpers', () => {
  const day = { dayOfWeek: 2, dayName: 'Tuesday', closed: false, openTime: '09:00:00', closeTime: '12:00:00' }

  it('offers start times that leave room for the minimum duration', () => {
    expect(startTimeOptions(day, 60, 60)).toEqual(['09:00', '10:00', '11:00'])
    expect(startTimeOptions(day, 60, 120)).toEqual(['09:00', '10:00'])
    expect(startTimeOptions({ ...day, closed: true }, 60, 60)).toEqual([])
  })

  it('hides start times that have already passed today', () => {
    expect(startTimeOptions(day, 60, 60, '2031-03-04', '2031-03-04T10:15:00')).toEqual(['11:00'])
    expect(startTimeOptions(day, 60, 60, '2031-03-05', '2031-03-04T10:15:00')).toEqual(['09:00', '10:00', '11:00'])
  })

  it('lists durations in slot steps', () => {
    expect(durationOptions(60, 180, 60)).toEqual([60, 120, 180])
  })

  it('extends a selection only across contiguous free slots within the maximum', () => {
    const grid = slots(['AVAILABLE', 'AVAILABLE', 'AVAILABLE', 'BOOKED', 'AVAILABLE'])
    const first = extendSelection(grid, null, 0, 60, 180)
    expect(first).toEqual({ startIndex: 0, endIndex: 0 })
    expect(extendSelection(grid, first, 2, 60, 180)).toEqual({ startIndex: 0, endIndex: 2 })
    // Over the maximum duration: start a new selection instead.
    expect(extendSelection(grid, first, 2, 60, 120)).toEqual({ startIndex: 2, endIndex: 2 })
    // Across a booked slot: start a new selection instead.
    expect(extendSelection(grid, { startIndex: 2, endIndex: 2 }, 4, 60, 180)).toEqual({ startIndex: 4, endIndex: 4 })
    // Booked slots cannot be selected.
    expect(extendSelection(grid, first, 3, 60, 180)).toEqual(first)
    // Clicking the only selected slot clears the selection.
    expect(extendSelection(grid, first, 0, 60, 180)).toBeNull()
  })
})

describe('calendar export', () => {
  it('writes an iCalendar event using the absolute start and end instants', () => {
    const ics = bookingToIcs(booking())
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toContain('DTSTART:20310304T043000Z')
    expect(ics).toContain('DTEND:20310304T063000Z')
    expect(ics).toContain('UID:SH-7KQ3PA@studyhive')
  })
})
