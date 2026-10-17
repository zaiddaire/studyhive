import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowLeft, CalendarDays, CalendarPlus, Check, Clock, Copy, MapPin, MessageSquareText, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button, ButtonLink } from '@/components/ui/Button'
import { BookingStatusBadge } from '@/components/ui/Badge'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { SmartImage } from '@/components/ui/SmartImage'
import { ApiError } from '@/lib/api'
import { countdown, datePart, formatDate, formatDateTime, formatDuration, durationMinutes, formatTimeRange } from '@/lib/time'
import { bookingToIcs, downloadTextFile, formatPrice } from '@/lib/utils'
import { bookingsApi, queryKeys } from '@/services'
import { useConfig } from '@/hooks/useConfig'
import { CancelBookingDialog } from './CancelBookingDialog'

function SuccessMark() {
  const reduce = useReducedMotion()
  return (
    <motion.div
      initial={reduce ? false : { scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 220, damping: 16 }}
      className="relative mx-auto flex size-20 items-center justify-center"
    >
      <svg viewBox="0 0 80 80" className="absolute inset-0" aria-hidden>
        <path d="M40 3 72 21.5v37L40 77 8 58.5v-37Z" fill="#E7EDE4" stroke="#435B47" strokeWidth="2.5" strokeLinejoin="round" />
      </svg>
      <svg viewBox="0 0 24 24" className="relative size-9" aria-hidden>
        <motion.path
          d="M5 12.5 10 17.5 19 7.5"
          fill="none"
          stroke="#435B47"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.55, delay: 0.25, ease: 'easeOut' }}
        />
      </svg>
      {!reduce &&
        [0, 1, 2, 3, 4, 5].map((i) => (
          <motion.span
            key={i}
            className="absolute size-2 rounded-full bg-champagne-400"
            initial={{ opacity: 0, x: 0, y: 0 }}
            animate={{ opacity: [0, 1, 0], x: Math.cos((i / 6) * Math.PI * 2) * 54, y: Math.sin((i / 6) * Math.PI * 2) * 54 }}
            transition={{ duration: 0.9, delay: 0.45, ease: 'easeOut' }}
            aria-hidden
          />
        ))}
    </motion.div>
  )
}

export default function BookingDetailPage() {
  const { id } = useParams()
  const bookingId = Number(id)
  const [params] = useSearchParams()
  const justConfirmed = params.get('confirmed') === '1'
  const [cancelOpen, setCancelOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const { data: config } = useConfig()
  const booking = useQuery({ queryKey: queryKeys.booking(bookingId), queryFn: () => bookingsApi.get(bookingId), enabled: bookingId > 0 })

  if (booking.isPending) {
    return (
      <div className="container-page max-w-3xl py-12">
        <Skeleton className="mx-auto h-20 w-20 rounded-full" />
        <Skeleton className="mx-auto mt-6 h-10 w-72" />
        <Skeleton className="mt-10 h-80 w-full rounded-[20px]" />
      </div>
    )
  }
  if (booking.isError) {
    if (booking.error instanceof ApiError && booking.error.status === 404) {
      return (
        <div className="container-page py-20">
          <EmptyState title="Booking not found" description="It may belong to another account, or the link is incorrect." action={<ButtonLink to="/dashboard">Go to my bookings</ButtonLink>} />
        </div>
      )
    }
    return (
      <div className="container-page py-20">
        <ErrorState error={booking.error} onRetry={() => booking.refetch()} />
      </div>
    )
  }

  const b = booking.data
  const date = datePart(b.startTime)
  const minutes = durationMinutes(b.startTime, b.endTime)
  const upcoming = new Date(b.endsAt).getTime() > Date.now()
  const showCelebration = justConfirmed && b.status === 'CONFIRMED'

  const copyReference = async () => {
    try {
      await navigator.clipboard.writeText(b.bookingReference)
      setCopied(true)
      toast.success('Reference copied')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy - please copy the reference manually.')
    }
  }

  return (
    <div className="container-page max-w-3xl pb-24 pt-8">
      <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-sage-700">
        <ArrowLeft className="size-4" aria-hidden /> My bookings
      </Link>

      <header className="mt-8 text-center">
        {showCelebration && <SuccessMark />}
        <h1 className="display mt-6 text-4xl sm:text-5xl" tabIndex={-1}>
          {showCelebration ? 'Your room is booked' : 'Booking details'}
        </h1>
        {showCelebration && (
          <p className="mx-auto mt-3 max-w-md text-muted">
            {b.room.name} is reserved for your group {config ? countdown(b.startsAt, Date.now(), date, config.today) : `on ${formatDate(date, 'medium')}`}. We’ve
            saved it to your dashboard.
          </p>
        )}
        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-line bg-card py-1.5 pl-4 pr-1.5 shadow-soft">
          <span className="text-xs uppercase tracking-wider text-muted">Reference</span>
          <span className="font-mono text-lg font-semibold tracking-wider">{b.bookingReference}</span>
          <button type="button" onClick={copyReference} className="rounded-full p-2 text-sage-700 hover:bg-sage-50" aria-label="Copy booking reference">
            {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          </button>
        </div>
      </header>

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: showCelebration ? 0.35 : 0 }}
        className="mt-10 overflow-hidden rounded-[22px] border border-line bg-card shadow-lift"
        aria-label="Booking summary"
      >
        <div className="grid sm:grid-cols-[220px_1fr]">
          <SmartImage src={b.room.coverImage?.url} alt={b.room.coverImage?.altText ?? b.room.name} width={480} className="aspect-[16/9] h-full w-full sm:aspect-auto" />
          <div className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-sage-700">Room {b.room.roomNumber}</p>
              <BookingStatusBadge status={b.status} upcoming={upcoming} />
            </div>
            <h2 className="display mt-1 text-3xl">{b.room.name}</h2>
            <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
              <div className="flex gap-2.5">
                <CalendarDays className="mt-0.5 size-4 shrink-0 text-sage-700" aria-hidden />
                <div>
                  <dt className="sr-only">Date</dt>
                  <dd>{formatDate(date, 'long')}</dd>
                </div>
              </div>
              <div className="flex gap-2.5">
                <Clock className="mt-0.5 size-4 shrink-0 text-sage-700" aria-hidden />
                <div>
                  <dt className="sr-only">Time</dt>
                  <dd>
                    {formatTimeRange(b.startTime, b.endTime)} · {formatDuration(minutes)}
                  </dd>
                </div>
              </div>
              <div className="flex gap-2.5">
                <Users className="mt-0.5 size-4 shrink-0 text-sage-700" aria-hidden />
                <div>
                  <dt className="sr-only">Group</dt>
                  <dd>
                    {b.groupSize} students{b.groupName ? ` · ${b.groupName}` : ''}
                  </dd>
                </div>
              </div>
              {b.room.location && (
                <div className="flex gap-2.5">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-sage-700" aria-hidden />
                  <div>
                    <dt className="sr-only">Location</dt>
                    <dd>{b.room.location}</dd>
                  </div>
                </div>
              )}
              {b.purpose && (
                <div className="flex gap-2.5 sm:col-span-2">
                  <MessageSquareText className="mt-0.5 size-4 shrink-0 text-sage-700" aria-hidden />
                  <div>
                    <dt className="sr-only">Purpose</dt>
                    <dd className="text-muted">{b.purpose}</dd>
                  </div>
                </div>
              )}
            </dl>
            {b.totalPrice !== undefined && (
              <p className="mt-4 border-t border-line pt-4 text-sm">
                Cost: <span className="font-semibold">{formatPrice(b.totalPrice)}</span>
              </p>
            )}
            {b.status === 'CANCELLED' && (
              <div className="mt-5 rounded-[12px] bg-danger-soft p-4 text-sm text-danger">
                <p className="font-semibold">{b.cancelledByAdmin ? 'Cancelled by an administrator' : 'You cancelled this booking'}</p>
                {b.cancellationReason && <p className="mt-1">Reason: {b.cancellationReason}</p>}
                {b.cancelledAt && config && <p className="mt-1 text-xs opacity-80">on {new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: config.timeZone }).format(new Date(b.cancelledAt))}</p>}
              </div>
            )}
            {b.status === 'CONFIRMED' && upcoming && (
              <p className="mt-5 text-xs text-muted">
                {b.cancellable && b.cancellationDeadline
                  ? `Free cancellation until ${formatDateTime(b.cancellationDeadline)}.`
                  : 'The cancellation window for this booking has closed.'}
              </p>
            )}
          </div>
        </div>
      </motion.section>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {b.status === 'CONFIRMED' && upcoming && (
          <Button variant="secondary" onClick={() => downloadTextFile(`studyhive-${b.bookingReference}.ics`, bookingToIcs(b), 'text/calendar')} icon={<CalendarPlus className="size-4" aria-hidden />}>
            Add to calendar
          </Button>
        )}
        <ButtonLink to="/dashboard" variant="secondary">
          View all my bookings
        </ButtonLink>
        <ButtonLink to="/rooms" variant="ghost">
          Book another room
        </ButtonLink>
        {b.cancellable && (
          <Button variant="ghost" className="text-danger hover:bg-danger-soft sm:ml-auto" onClick={() => setCancelOpen(true)}>
            Cancel booking
          </Button>
        )}
      </div>
      <CancelBookingDialog booking={b} open={cancelOpen} onOpenChange={setCancelOpen} />
    </div>
  )
}
