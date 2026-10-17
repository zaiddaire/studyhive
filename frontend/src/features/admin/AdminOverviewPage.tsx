import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { Ban, CalendarCheck, CalendarClock, CalendarPlus, DoorOpen, Gauge, RotateCcw, Users } from 'lucide-react'
import { AdminPageHeader } from '@/components/layout/AdminLayout'
import { Button, ButtonLink } from '@/components/ui/Button'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { staggerChild, staggerParent } from '@/components/ui/Motion'
import { useConfig } from '@/hooks/useConfig'
import { formatInstant } from '@/lib/time'
import { adminApi, queryKeys } from '@/services'
import type { BookingEventType } from '@/types/api'
import { BookingsNext7Days, RoomUtilizationBars } from './charts'

const activityText: Record<BookingEventType, { label: string; icon: typeof CalendarPlus; tone: string }> = {
  CREATED: { label: 'booked', icon: CalendarPlus, tone: 'bg-success-soft text-success' },
  CANCELLED_BY_STUDENT: { label: 'cancelled by student', icon: Ban, tone: 'bg-danger-soft text-danger' },
  CANCELLED_BY_ADMIN: { label: 'cancelled by admin', icon: Ban, tone: 'bg-danger-soft text-danger' },
  COMPLETED: { label: 'completed', icon: CalendarCheck, tone: 'bg-sage-100 text-sage-700' },
}

export default function AdminOverviewPage() {
  const stats = useQuery({ queryKey: queryKeys.admin.stats, queryFn: adminApi.stats, refetchInterval: 60_000 })
  const { data: config } = useConfig()

  return (
    <>
      <AdminPageHeader
        title="Overview"
        description="Live figures calculated from rooms and bookings in the database."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => stats.refetch()} loading={stats.isFetching} icon={<RotateCcw className="size-4" aria-hidden />}>
              Refresh
            </Button>
            <ButtonLink to="/admin/rooms/new" size="sm">
              Add room
            </ButtonLink>
          </>
        }
      />
      {stats.isPending ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-[16px]" />
          ))}
        </div>
      ) : stats.isError ? (
        <ErrorState error={stats.error} onRetry={() => stats.refetch()} />
      ) : (
        <>
          <motion.ul className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5" aria-label="Key figures" variants={staggerParent} initial="hidden" animate="show">
            {[
              { label: 'Rooms', value: stats.data.totalRooms, sub: `${stats.data.activeRooms} active`, icon: DoorOpen, to: '/admin/rooms' },
              { label: 'Reservations today', value: stats.data.reservationsToday, sub: 'starting today', icon: CalendarClock, to: '/admin/bookings' },
              { label: 'Upcoming', value: stats.data.upcomingReservations, sub: 'confirmed, not started', icon: CalendarCheck, to: '/admin/bookings?status=CONFIRMED' },
              { label: 'Cancelled', value: stats.data.cancelledReservations, sub: 'all time', icon: Ban, to: '/admin/bookings?status=CANCELLED' },
              {
                label: `Utilisation (${stats.data.utilizationWindowDays} days)`,
                value: stats.data.utilizationPercent !== undefined && stats.data.utilizationPercent !== null ? `${stats.data.utilizationPercent}%` : '–',
                sub: 'booked of open hours',
                icon: Gauge,
                to: undefined,
              },
            ].map((s) => (
              <motion.li key={s.label} variants={staggerChild} className="relative flex flex-col last:col-span-2 xl:last:col-span-1 rounded-[16px] border border-line bg-card p-5 shadow-soft">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted">{s.label}</p>
                  <s.icon className="size-4 text-sage-700" aria-hidden />
                </div>
                <p className="mt-3 font-serif text-4xl leading-none text-ink">{s.value}</p>
                <p className="mt-2 text-xs text-muted">{s.sub}</p>
                {s.to && <Link to={s.to} className="absolute inset-0 rounded-[16px]" aria-label={`View ${s.label.toLowerCase()}`} />}
              </motion.li>
            ))}
          </motion.ul>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
            <section className="rounded-[18px] border border-line bg-card p-6 shadow-soft" aria-labelledby="next7">
              <h2 id="next7" className="text-base font-semibold">
                Bookings over the next 7 days
              </h2>
              <p className="mb-6 text-xs text-muted">Confirmed sessions by start date · {stats.data.totalStudents} registered students</p>
              <BookingsNext7Days data={stats.data.next7Days} />
            </section>
            <section className="rounded-[18px] border border-line bg-card p-6 shadow-soft" aria-labelledby="util">
              <h2 id="util" className="text-base font-semibold">
                Room utilisation
              </h2>
              <p className="mb-6 text-xs text-muted">Booked hours ÷ open hours over the last {stats.data.utilizationWindowDays} days (today up to now)</p>
              {stats.data.roomUtilization.length ? (
                <RoomUtilizationBars rows={stats.data.roomUtilization} />
              ) : (
                <p className="text-sm text-muted">No active rooms.</p>
              )}
            </section>
          </div>

          <section className="mt-6 rounded-[18px] border border-line bg-card p-6 shadow-soft" aria-labelledby="activity">
            <div className="flex items-center justify-between">
              <h2 id="activity" className="text-base font-semibold">
                Recent booking activity
              </h2>
              <Link to="/admin/bookings?sort=created_desc" className="text-sm font-medium text-sage-700 hover:underline">
                All bookings
              </Link>
            </div>
            {stats.data.recentActivity.length === 0 ? (
              <EmptyState className="mt-4" icon={<Users className="size-6" aria-hidden />} title="No activity yet" description="New bookings and cancellations will appear here." />
            ) : (
              <ol className="mt-4 divide-y divide-line">
                {stats.data.recentActivity.map((a, i) => {
                  const meta = activityText[a.type]
                  return (
                    <li key={`${a.bookingId}-${a.type}-${i}`} className="flex items-start gap-3 py-3">
                      <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${meta.tone}`}>
                        <meta.icon className="size-4" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1 text-sm">
                        <p>
                          <Link to={`/admin/bookings?reference=${a.bookingReference}`} className="font-mono font-semibold hover:text-sage-700">
                            {a.bookingReference}
                          </Link>{' '}
                          <span className="text-muted">{meta.label}</span> · {a.roomName}
                          {a.actorName && <span className="text-muted"> · by {a.actorName}</span>}
                        </p>
                        {a.details && <p className="truncate text-xs text-muted">{a.details}</p>}
                      </div>
                      <time className="shrink-0 text-xs text-muted" dateTime={a.createdAt}>
                        {config ? formatInstant(a.createdAt, config.timeZone) : ''}
                      </time>
                    </li>
                  )
                })}
              </ol>
            )}
          </section>
        </>
      )}
    </>
  )
}
