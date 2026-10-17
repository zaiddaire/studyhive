import type { DayHours, IsoDate, LocalDateTime, Slot } from '@/types/api'
import { isoDayOfWeek, minutesOf, timeFromMinutes, timePart } from './time'

/** Start times on a day whose earliest possible booking still fits before closing. */
export function startTimeOptions(
  hours: DayHours | undefined,
  slotMinutes: number,
  minDurationMinutes: number,
  date?: IsoDate,
  serverNow?: LocalDateTime,
): string[] {
  if (!hours || hours.closed || !hours.openTime || !hours.closeTime) return []
  const open = minutesOf(hours.openTime)
  const close = minutesOf(hours.closeTime)
  const nowMinutes = date && serverNow && serverNow.startsWith(date) ? minutesOf(timePart(serverNow)) : -1
  const out: string[] = []
  for (let m = open; m + minDurationMinutes <= close; m += slotMinutes) {
    if (m > nowMinutes) out.push(timeFromMinutes(m))
  }
  return out
}

export function durationOptions(min: number, max: number, slot: number): number[] {
  const out: number[] = []
  for (let d = min; d <= max; d += slot) out.push(d)
  return out
}

export function hoursForDate(weekly: DayHours[] | undefined, date: IsoDate | undefined): DayHours | undefined {
  if (!weekly || !date) return undefined
  return weekly.find((h) => h.dayOfWeek === isoDayOfWeek(date))
}

/**
 * Selecting a range on the slot grid: the first click picks a start slot; a later click extends the range
 * if every slot in between is available and the total stays within the maximum duration.
 */
export function extendSelection(
  slots: Slot[],
  current: { startIndex: number; endIndex: number } | null,
  clickedIndex: number,
  slotMinutes: number,
  maxDurationMinutes: number,
): { startIndex: number; endIndex: number } | null {
  if (slots[clickedIndex]?.status !== 'AVAILABLE') return current
  if (!current) return { startIndex: clickedIndex, endIndex: clickedIndex }
  const { startIndex, endIndex } = current
  if (clickedIndex >= startIndex && clickedIndex <= endIndex) {
    // Clicking inside the selection shrinks it to end there; clicking the only slot clears it.
    if (startIndex === endIndex) return null
    return { startIndex, endIndex: clickedIndex === startIndex ? startIndex : clickedIndex }
  }
  const from = Math.min(startIndex, clickedIndex)
  const to = Math.max(endIndex, clickedIndex)
  const contiguousFree = slots.slice(from, to + 1).every((s) => s.status === 'AVAILABLE')
  const withinMax = (to - from + 1) * slotMinutes <= maxDurationMinutes
  if (contiguousFree && withinMax) return { startIndex: from, endIndex: to }
  return { startIndex: clickedIndex, endIndex: clickedIndex }
}
