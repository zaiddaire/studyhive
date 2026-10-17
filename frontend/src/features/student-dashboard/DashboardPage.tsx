import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, CalendarCheck, CalendarDays, CalendarX, Clock, Hourglass, MapPin, Plus, UserRound, Users } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { Pagination } from '@/components/ui/Pagination'
import { SmartImage } from '@/components/ui/SmartImage'
import { staggerParent } from '@/components/ui/Motion'
import { useAuth } from '@/features/auth/AuthProvider'
import { useConfig } from '@/hooks/useConfig'
import { BookingCard } from '@/features/bookings/BookingCard'
import { CancelBookingDialog } from '@/features/bookings/CancelBookingDialog'
import { countdown, datePart, formatDate, formatTimeRange, greeting } from '@/lib/time'
import { cn, firstName, initials } from '@/lib/utils'
import { bookingsApi, queryKeys, type BookingScope } from '@/services'
import type { Booking } from '@/types/api'

const tabs: { scope: BookingScope; label: string; empty: { title: string; text: string } }[] = [
  { scope: 'upcoming', label: 'Upcoming', empty: { title: 'No upcoming sessions', text: 'When you book a room, it will appear here with its reference and time.' } },
  { scope: 'past', label: 'History', empty: { title: 'No past sessions yet', text: 'Completed study sessions are listed here.' } },
  { scope: 'cancelled', label: 'Cancelled', empty: { title: 'Nothing cancelled', text: 'Bookings you or an administrator cancel will show up here.' } },
]

function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

function NextSession({ booking }: { booking: Booking }) {
  const now = useNow()
  const { data: config } = useConfig()
  const date = datePart(booking.startTime)
  const inProgress = new Date(booking.startsAt).getTime() <= now
  return (
    <Link
      to={`/bookings/${booking.id}`}
      className="group relative flex flex-col overflow-hidden rounded-[22px] bg-sage-800 text-white shadow-panel transition hover:-translate-y-0.5 sm:flex-row"
    >
      <div className="relative sm:w-2/5">
        <SmartImage src={booking.room.coverImage?.url} alt="" width={640} className="aspect-[16/9] h-full w-full opacity-90 sm:aspect-auto" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-sage-800/70" aria-hidden />
      </div>
      <div className="honeycomb-bg flex flex-1 flex-col justify-between gap-6 p-6 sm:p-8">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-champagne-400">
            <Hourglass className="size-3.5" aria-hidden /> {inProgress ? 'Happening now' : `Next session ${config ? countdown(booking.startsAt, now, date, config.today) : ''}`}
          </p>
          <h2 className="display mt-3 text-3xl !text-white sm:text-4xl">{booking.room.name}</h2>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-sage-100">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" aria-hidden /> {formatDate(date, 'medium')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-4" aria-hidden /> {formatTimeRange(booking.startTime, booking.endTime)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-4" aria-hidden /> {booking.groupSize} students
            </span>
            {booking.room.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4" aria-hidden /> {booking.room.location}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full bg-white/10 px-3 py-1 font-mono text-sm tracking-wider">{booking.bookingReference}</span>
          <span className="inline-flex items-center gap-1 text-sm font-medium text-champagne-400">
            Details <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
          </span>
        </div>
      </div>
    </Link>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [scope, setScope] = useState<BookingScope>('upcoming')
  const [page, setPage] = useState(0)
  const [cancelling, setCancelling] = useState<Booking | null>(null)

  const summary = useQuery({ queryKey: queryKeys.mySummary, queryFn: bookingsApi.summary })
  const list = useQuery({
    queryKey: queryKeys.myBookings(scope, page),
    queryFn: () => bookingsApi.mine(scope, page, 6),
    placeholderData: keepPreviousData,
  })

  const counts = { upcoming: summary.data?.upcomingCount, past: summary.data?.pastCount, cancelled: summary.data?.cancelledCount }
  const activeTab = tabs.find((t) => t.scope === scope)!

  return (
    <div className="container-page pb-24 pt-10">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Student dashboard</p>
          <h1 className="display mt-3 text-4xl sm:text-5xl">
            {greeting()}, {firstName(user?.fullName)}.
          </h1>
          <p className="mt-2 text-muted">Here’s everything your study groups have coming up.</p>
        </div>
        <ButtonLink to="/rooms" size="lg" icon={<Plus className="size-[18px]" aria-hidden />}>
          Book a room
        </ButtonLink>
      </header>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          {summary.isPending ? (
            <Skeleton className="h-56 w-full rounded-[22px]" />
          ) : summary.isError ? (
            <ErrorState error={summary.error} onRetry={() => summary.refetch()} />
          ) : summary.data.nextBooking ? (
            <NextSession booking={summary.data.nextBooking} />
          ) : (
            <EmptyState
              icon={<CalendarDays className="size-6" aria-hidden />}
              title="Your calendar is wide open"
              description="Find a room that fits your group and reserve it in a few taps."
              action={<ButtonLink to="/rooms">Find a study room</ButtonLink>}
            />
          )}
        </div>
        <aside className="flex flex-col gap-4" aria-label="Your account">
          <div className="rounded-[18px] border border-line bg-card p-5 shadow-soft">
            <div className="flex items-center gap-3">
              <span className="flex size-12 items-center justify-center rounded-full bg-sage-700 font-semibold text-white">{initials(user?.fullName)}</span>
              <div className="min-w-0">
                <p className="truncate font-semibold">{user?.fullName}</p>
                <p className="truncate text-sm text-muted">{user?.email}</p>
              </div>
            </div>
            <Link to="/profile" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-sage-700 hover:underline">
              <UserRound className="size-4" aria-hidden /> Manage profile
            </Link>
          </div>
          <dl className="grid grid-cols-3 gap-3">
            {[
              { label: 'Upcoming', value: counts.upcoming, icon: CalendarDays },
              { label: 'Completed', value: counts.past, icon: CalendarCheck },
              { label: 'Cancelled', value: counts.cancelled, icon: CalendarX },
            ].map((s) => (
              <div key={s.label} className="flex flex-col items-center rounded-[14px] border border-line bg-card p-3 text-center">
                <s.icon className="size-4 text-sage-700" aria-hidden />
                <dt className="order-last text-[11px] text-muted">{s.label}</dt>
                <dd className="mt-1 font-serif text-2xl">{s.value ?? '–'}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>

      <section className="mt-14" aria-labelledby="bookings-heading">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="bookings-heading" className="display text-3xl">
            My bookings
          </h2>
          <div role="tablist" aria-label="Booking lists" className="inline-flex rounded-[12px] border border-line bg-card p-1">
            {tabs.map((t) => (
              <button
                key={t.scope}
                role="tab"
                type="button"
                aria-selected={scope === t.scope}
                aria-controls="bookings-panel"
                id={`tab-${t.scope}`}
                onClick={() => {
                  setScope(t.scope)
                  setPage(0)
                }}
                className={cn(
                  'relative rounded-[9px] px-3.5 py-1.5 text-sm font-medium transition-colors',
                  scope === t.scope ? 'text-white' : 'text-muted hover:text-ink',
                )}
              >
                {scope === t.scope && <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-[9px] bg-sage-700" transition={{ duration: 0.25 }} />}
                <span className="relative">
                  {t.label}
                  {counts[t.scope] !== undefined && <span className="ml-1.5 text-xs opacity-80">{counts[t.scope]}</span>}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div id="bookings-panel" role="tabpanel" aria-labelledby={`tab-${scope}`} className="mt-6">
          {list.isPending ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-[16px]" />
              ))}
            </div>
          ) : list.isError ? (
            <ErrorState error={list.error} onRetry={() => list.refetch()} />
          ) : list.data.content.length === 0 ? (
            <EmptyState
              title={activeTab.empty.title}
              description={activeTab.empty.text}
              action={scope === 'upcoming' ? <ButtonLink to="/rooms">Book a room</ButtonLink> : undefined}
            />
          ) : (
            <>
              <AnimatePresence mode="wait">
                <motion.ul key={`${scope}-${page}`} className="space-y-3" variants={staggerParent} initial="hidden" animate="show" exit={{ opacity: 0 }}>
                  {list.data.content.map((b) => (
                    <BookingCard key={b.id} booking={b} onCancel={setCancelling} />
                  ))}
                </motion.ul>
              </AnimatePresence>
              <div className="mt-6">
                <Pagination page={page} totalPages={list.data.totalPages} onChange={setPage} label="Booking pages" />
              </div>
            </>
          )}
        </div>
      </section>

      {cancelling && <CancelBookingDialog booking={cancelling} open={Boolean(cancelling)} onOpenChange={(o) => !o && setCancelling(null)} />}
    </div>
  )
}
