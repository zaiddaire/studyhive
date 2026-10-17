import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { Ban, Check, Clock, Lock, Wrench } from 'lucide-react'
import { DatePicker } from '@/components/ui/DatePicker'
import { ErrorState, Skeleton } from '@/components/ui/Feedback'
import { extendSelection } from '@/lib/booking'
import { addDays, formatDayNumber, formatDuration, formatTimeRange, timePart } from '@/lib/time'
import { cn } from '@/lib/utils'
import { publicApi, queryKeys } from '@/services'
import type { IsoDate, Slot, SlotStatus } from '@/types/api'

export interface SlotSelection {
  startIndex: number
  endIndex: number
}

const statusText: Record<SlotStatus, string> = {
  AVAILABLE: 'Available',
  BOOKED: 'Booked',
  BLOCKED: 'Unavailable',
  PAST: 'Past',
  OUTSIDE_WINDOW: 'Not open yet',
  CLOSED: 'Closed',
}

function StatusIcon({ status, selected }: { status: SlotStatus; selected: boolean }) {
  const cls = 'size-3.5 shrink-0'
  if (selected) return <Check className={cls} aria-hidden />
  if (status === 'BOOKED') return <Lock className={cls} aria-hidden />
  if (status === 'BLOCKED') return <Wrench className={cls} aria-hidden />
  if (status === 'AVAILABLE') return <span className="size-2 rounded-full bg-success" aria-hidden />
  if (status === 'CLOSED') return <Ban className={cls} aria-hidden />
  return <Clock className={cls} aria-hidden />
}

export function SlotGrid({
  slots,
  selection,
  onSelect,
  compact = false,
}: {
  slots: Slot[]
  selection: SlotSelection | null
  onSelect: (index: number) => void
  compact?: boolean
}) {
  return (
    <ul className={cn('grid gap-2', compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3')} aria-label="Time slots">
      {slots.map((slot, i) => {
        const selected = selection !== null && i >= selection.startIndex && i <= selection.endIndex
        const available = slot.status === 'AVAILABLE'
        const label = `${formatTimeRange(slot.start, slot.end)}, ${selected ? 'selected' : statusText[slot.status]}`
        return (
          <li key={slot.start}>
            <motion.button
              type="button"
              disabled={!available}
              onClick={() => onSelect(i)}
              aria-pressed={available ? selected : undefined}
              aria-label={label}
              whileTap={available ? { scale: 0.96 } : undefined}
              animate={selected ? { scale: [1, 1.04, 1] } : { scale: 1 }}
              transition={{ duration: 0.25 }}
              className={cn(
                'flex min-h-[58px] w-full flex-col items-start justify-center gap-0.5 rounded-[10px] border px-3 py-2 text-left transition-colors duration-200',
                selected && 'border-sage-700 bg-sage-700 text-white shadow-soft',
                !selected && available && 'border-line-strong bg-card text-ink hover:border-sage-500 hover:bg-sage-50',
                (slot.status === 'BOOKED' || slot.status === 'BLOCKED') && 'hatched cursor-not-allowed border-line bg-sage-50/60 text-muted',
                (slot.status === 'PAST' || slot.status === 'OUTSIDE_WINDOW' || slot.status === 'CLOSED') &&
                  'cursor-not-allowed border-dashed border-line bg-transparent text-subtle',
              )}
            >
              <span className={cn('text-sm font-semibold tabular-nums', !available && !selected && 'line-through decoration-1 opacity-80')}>
                {formatTimeRange(slot.start, slot.end)}
              </span>
              <span className={cn('flex items-center gap-1.5 text-[11px] font-medium', selected ? 'text-sage-100' : '')}>
                <StatusIcon status={slot.status} selected={selected} />
                {selected ? 'Selected' : statusText[slot.status]}
              </span>
            </motion.button>
          </li>
        )
      })}
    </ul>
  )
}

export function SlotLegend() {
  const item = 'flex items-center gap-1.5'
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted" aria-label="Legend">
      <li className={item}>
        <span className="size-3 rounded-sm border border-line-strong bg-card" aria-hidden /> Available
      </li>
      <li className={item}>
        <span className="flex size-3 items-center justify-center rounded-sm bg-sage-700" aria-hidden>
          <Check className="size-2.5 text-white" />
        </span>{' '}
        Selected
      </li>
      <li className={item}>
        <Lock className="size-3" aria-hidden /> Booked
      </li>
      <li className={item}>
        <Wrench className="size-3" aria-hidden /> Maintenance / event
      </li>
      <li className={item}>
        <Clock className="size-3" aria-hidden /> Past or not yet open
      </li>
    </ul>
  )
}

interface SlotPickerProps {
  roomId: number
  date: IsoDate
  onDateChange: (date: IsoDate) => void
  today: IsoDate
  advanceDays: number
  maxDurationMinutes: number
  selection: SlotSelection | null
  onSelectionChange: (selection: SlotSelection | null, slots: Slot[]) => void
  compact?: boolean
}

/** Date strip + calendar + live slot grid. Availability always comes from the server for the chosen date. */
export function SlotPicker({ roomId, date, onDateChange, today, advanceDays, maxDurationMinutes, selection, onSelectionChange, compact }: SlotPickerProps) {
  const availability = useQuery({
    queryKey: queryKeys.availability(roomId, date),
    queryFn: () => publicApi.availability(roomId, date),
    refetchInterval: 60_000,
  })
  const strip = useMemo(() => Array.from({ length: Math.min(7, advanceDays + 1) }, (_, i) => addDays(today, i)), [today, advanceDays])
  const slots = availability.data?.slots ?? []
  const free = slots.filter((s) => s.status === 'AVAILABLE').length

  const select = (index: number) => {
    const next = extendSelection(slots, selection, index, availability.data?.slotDurationMinutes ?? 60, maxDurationMinutes)
    onSelectionChange(next, slots)
  }

  const selectedRange =
    selection && slots[selection.startIndex] && slots[selection.endIndex]
      ? { start: slots[selection.startIndex].start, end: slots[selection.endIndex].end }
      : null

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">Choose a date</p>
          <div className="w-44">
            <DatePicker value={date} onChange={onDateChange} min={today} maxDays={advanceDays} placeholder="More dates" labelFormat="short" />
          </div>
        </div>
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Upcoming dates">
          {strip.map((d) => {
            const f = formatDayNumber(d)
            const active = d === date
            return (
              <button
                key={d}
                type="button"
                onClick={() => onDateChange(d)}
                aria-pressed={active}
                className={cn(
                  'flex min-w-[58px] flex-col items-center rounded-[12px] border px-2 py-2 transition-colors',
                  active ? 'border-sage-700 bg-sage-700 text-white' : 'border-line bg-card hover:border-sage-400',
                )}
              >
                <span className={cn('text-[11px] font-medium uppercase', active ? 'text-sage-100' : 'text-muted')}>{d === today ? 'Today' : f.weekday}</span>
                <span className="font-serif text-xl leading-tight">{f.day}</span>
                <span className={cn('text-[11px]', active ? 'text-sage-100' : 'text-muted')}>{f.month}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-semibold">Choose your time</p>
          {availability.data && availability.data.open && (
            <p className="text-xs text-muted" aria-live="polite">
              {timePart(availability.data.openTime ?? '')}–{timePart(availability.data.closeTime ?? '')} · {free} of {slots.length} free
            </p>
          )}
        </div>
        {availability.isPending ? (
          <div className={cn('grid gap-2', compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3')}>
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-[58px] rounded-[10px]" />
            ))}
          </div>
        ) : availability.isError ? (
          <ErrorState error={availability.error} onRetry={() => availability.refetch()} title="Availability could not be loaded" />
        ) : (
          <>
            {availability.data.message && (
              <p className="mb-3 rounded-[10px] bg-warning-soft px-3 py-2 text-sm text-warning" role="status">
                {availability.data.message}
              </p>
            )}
            {slots.length > 0 && <SlotGrid slots={slots} selection={selection} onSelect={select} compact={compact} />}
            <div className="mt-4">
              <SlotLegend />
            </div>
            <p className="mt-3 text-xs text-muted">Tip: select a start slot, then a later slot to extend your booking (up to {formatDuration(maxDurationMinutes)}).</p>
          </>
        )}
      </div>

      <div aria-live="polite" className="sr-only">
        {selectedRange ? `Selected ${formatTimeRange(selectedRange.start, selectedRange.end)}` : 'No time selected'}
      </div>
    </div>
  )
}
