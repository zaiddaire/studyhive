import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { ChevronRight, Clock, Users } from 'lucide-react'
import { BookingStatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { SmartImage } from '@/components/ui/SmartImage'
import { staggerChild } from '@/components/ui/Motion'
import { datePart, formatDayNumber, formatTimeRange } from '@/lib/time'
import type { Booking } from '@/types/api'

export function BookingCard({ booking, onCancel }: { booking: Booking; onCancel?: (booking: Booking) => void }) {
  const d = formatDayNumber(datePart(booking.startTime))
  const upcoming = new Date(booking.endsAt).getTime() > Date.now()
  return (
    <motion.li variants={staggerChild} layout className="list-none">
      <article className="group flex flex-col gap-4 rounded-[16px] border border-line bg-card p-4 shadow-soft transition hover:border-sage-200 hover:shadow-lift sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <div className="flex w-16 shrink-0 flex-col items-center rounded-[12px] bg-sage-50 py-2 text-sage-800" aria-hidden>
            <span className="text-[11px] font-semibold uppercase tracking-wide">{d.weekday}</span>
            <span className="font-serif text-2xl leading-tight">{d.day}</span>
            <span className="text-[11px]">{d.month}</span>
          </div>
          <SmartImage src={booking.room.coverImage?.url} alt="" width={200} className="hidden h-16 w-24 shrink-0 rounded-[10px] sm:block" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold">
              <Link to={`/bookings/${booking.id}`} className="hover:text-sage-700">
                {booking.room.name}
              </Link>
            </h3>
            <span className="text-xs text-muted">Room {booking.room.roomNumber}</span>
            <BookingStatusBadge status={booking.status} upcoming={upcoming} />
          </div>
          <p className="sr-only">{`${d.weekday} ${d.day} ${d.month}`}</p>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-4 text-sage-700" aria-hidden />
              {formatTimeRange(booking.startTime, booking.endTime)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-4 text-sage-700" aria-hidden />
              {booking.groupSize} students{booking.groupName ? ` · ${booking.groupName}` : ''}
            </span>
            <span className="font-mono text-xs leading-5 tracking-wide">{booking.bookingReference}</span>
          </div>
          {booking.status === 'CANCELLED' && booking.cancellationReason && (
            <p className="mt-1.5 text-xs text-danger">
              {booking.cancelledByAdmin ? 'Cancelled by an administrator: ' : 'Reason: '}
              {booking.cancellationReason}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 sm:flex-col sm:items-end">
          <Link
            to={`/bookings/${booking.id}`}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-sage-700 hover:bg-sage-50"
            aria-label={`View details for booking ${booking.bookingReference}`}
          >
            View details <ChevronRight className="size-4" aria-hidden />
          </Link>
          {booking.cancellable && onCancel && (
            <Button variant="ghost" size="sm" className="text-danger hover:bg-danger-soft" onClick={() => onCancel(booking)}>
              Cancel
            </Button>
          )}
        </div>
      </article>
    </motion.li>
  )
}
