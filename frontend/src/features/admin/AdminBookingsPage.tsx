import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, CalendarPlus, CalendarCheck, Eye, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { AdminPageHeader } from '@/components/layout/AdminLayout'
import { BookingStatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, FormError, Input, Select, Textarea } from '@/components/ui/Field'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { Pagination } from '@/components/ui/Pagination'
import { useConfig } from '@/hooks/useConfig'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { errorMessage } from '@/lib/api'
import { datePart, formatDate, formatInstant, formatTimeRange } from '@/lib/time'
import { adminApi, queryKeys, type AdminBookingParams } from '@/services'
import type { Booking, BookingEventType, BookingStatus } from '@/types/api'

const eventLabels: Record<BookingEventType, string> = {
  CREATED: 'Booked',
  CANCELLED_BY_STUDENT: 'Cancelled by student',
  CANCELLED_BY_ADMIN: 'Cancelled by administrator',
  COMPLETED: 'Completed',
}

function BookingDetailDialog({ bookingId, onClose }: { bookingId: number; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { data: config } = useConfig()
  const booking = useQuery({ queryKey: queryKeys.admin.booking(bookingId), queryFn: () => adminApi.booking(bookingId) })
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState('')
  const cancel = useMutation({
    mutationFn: () => adminApi.cancelBooking(bookingId, reason.trim()),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.admin.booking(bookingId), updated)
      queryClient.invalidateQueries({ queryKey: ['admin', 'bookings'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] })
      queryClient.invalidateQueries({ queryKey: ['availability', updated.room.id] })
      toast.success(`Booking ${updated.bookingReference} cancelled`)
      setCancelling(false)
    },
  })
  const b = booking.data
  const reasonValid = reason.trim().length >= 3

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && !cancel.isPending && onClose()}
      title={b ? `Booking ${b.bookingReference}` : 'Booking'}
      description={b ? `${b.room.name} · ${formatDate(datePart(b.startTime), 'medium')} · ${formatTimeRange(b.startTime, b.endTime)}` : undefined}
      size="lg"
      footer={
        b && b.cancellable ? (
          cancelling ? (
            <>
              <Button variant="secondary" onClick={() => setCancelling(false)} disabled={cancel.isPending}>
                Back
              </Button>
              <Button variant="danger" onClick={() => cancel.mutate()} loading={cancel.isPending} disabled={!reasonValid}>
                Confirm cancellation
              </Button>
            </>
          ) : (
            <Button variant="danger" onClick={() => setCancelling(true)} icon={<Ban className="size-4" aria-hidden />}>
              Cancel booking
            </Button>
          )
        ) : undefined
      }
    >
      {booking.isPending ? (
        <Skeleton className="h-60 w-full" />
      ) : booking.isError ? (
        <ErrorState error={booking.error} onRetry={() => booking.refetch()} />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-2">
            <BookingStatusBadge status={b!.status} upcoming={new Date(b!.endsAt).getTime() > Date.now()} />
            {b!.cancellationReason && <span className="text-sm text-muted">Reason: {b!.cancellationReason}</span>}
          </div>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            {[
              ['Student', `${b!.owner?.fullName ?? '—'}`],
              ['Email', b!.owner?.email ?? '—'],
              ['Room', `${b!.room.name} (${b!.room.roomNumber})`],
              ['Group', `${b!.groupSize} students${b!.groupName ? ` · ${b!.groupName}` : ''}`],
              ['Purpose', b!.purpose ?? '—'],
              ['Created', config ? formatInstant(b!.createdAt, config.timeZone) : '—'],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted">{k}</dt>
                <dd className="mt-0.5 break-words">{v}</dd>
              </div>
            ))}
          </dl>
          <div>
            <h3 className="text-sm font-semibold">History</h3>
            <ol className="mt-3 space-y-3 border-l border-line pl-4">
              {b!.history?.map((e, i) => (
                <li key={i} className="relative text-sm">
                  <span className="absolute -left-[21px] top-1 flex size-2.5 rounded-full bg-sage-700 ring-4 ring-card" aria-hidden />
                  <p className="font-medium">
                    {eventLabels[e.type]}
                    {e.actorName && <span className="font-normal text-muted"> by {e.actorName}</span>}
                  </p>
                  {e.details && <p className="text-muted">{e.details}</p>}
                  <p className="text-xs text-muted">{config ? formatInstant(e.createdAt, config.timeZone) : ''}</p>
                </li>
              ))}
            </ol>
          </div>
          {cancelling && (
            <div className="rounded-[14px] border border-danger/20 bg-danger-soft/40 p-4">
              <Field label="Reason for cancellation" required hint="The student sees this on their booking." error={reason && !reasonValid ? 'Use at least 3 characters.' : undefined}>
                {(a) => <Textarea {...a} rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />}
              </Field>
              <div className="mt-3">
                <FormError message={cancel.isError ? errorMessage(cancel.error) : null} />
              </div>
            </div>
          )}
        </div>
      )}
    </Dialog>
  )
}

export default function AdminBookingsPage() {
  const [params, setParams] = useSearchParams()
  const rooms = useQuery({ queryKey: queryKeys.admin.rooms, queryFn: adminApi.rooms })
  const [reference, setReference] = useState(params.get('reference') ?? '')
  const [student, setStudent] = useState(params.get('student') ?? '')
  const debouncedRef = useDebouncedValue(reference)
  const debouncedStudent = useDebouncedValue(student)
  const [openId, setOpenId] = useState<number | null>(null)

  const set = (patch: Record<string, string | undefined>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [k, v] of Object.entries(patch)) {
          if (v) next.set(k, v)
          else next.delete(k)
        }
        if (!('page' in patch)) next.delete('page')
        return next
      },
      { replace: true },
    )

  useEffect(() => {
    if ((params.get('reference') ?? '') !== debouncedRef) set({ reference: debouncedRef.trim() || undefined })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedRef])
  useEffect(() => {
    if ((params.get('student') ?? '') !== debouncedStudent) set({ student: debouncedStudent.trim() || undefined })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedStudent])

  const query: AdminBookingParams = {
    reference: params.get('reference') || undefined,
    student: params.get('student') || undefined,
    roomId: params.get('roomId') ? Number(params.get('roomId')) : undefined,
    status: (params.get('status') as BookingStatus) || undefined,
    from: params.get('from') || undefined,
    to: params.get('to') || undefined,
    sort: (params.get('sort') as AdminBookingParams['sort']) || 'start_desc',
    page: Math.max(0, Number(params.get('page') ?? 1) - 1),
    size: 15,
  }
  const bookings = useQuery({ queryKey: queryKeys.admin.bookings(query), queryFn: () => adminApi.bookings(query), placeholderData: keepPreviousData })
  const hasFilters = ['reference', 'student', 'roomId', 'status', 'from', 'to'].some((k) => params.get(k))

  return (
    <>
      <AdminPageHeader title="Bookings" description="Search every reservation, review its history and cancel with a reason when needed." />
      <div className="rounded-[18px] border border-line bg-card p-4 shadow-soft sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <Field label="Reference">
            {(a) => (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
                <Input {...a} className="pl-9" placeholder="SH-…" value={reference} onChange={(e) => setReference(e.target.value)} />
              </div>
            )}
          </Field>
          <Field label="Student">
            {(a) => <Input {...a} placeholder="Name or email" value={student} onChange={(e) => setStudent(e.target.value)} />}
          </Field>
          <Field label="Room">
            {(a) => (
              <Select {...a} value={params.get('roomId') ?? ''} onChange={(e) => set({ roomId: e.target.value || undefined })}>
                <option value="">All rooms</option>
                {rooms.data?.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.roomNumber} · {r.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Status">
            {(a) => (
              <Select {...a} value={params.get('status') ?? ''} onChange={(e) => set({ status: e.target.value || undefined })}>
                <option value="">Any status</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </Select>
            )}
          </Field>
          <Field label="From">
            {(a) => <Input {...a} type="date" value={params.get('from') ?? ''} onChange={(e) => set({ from: e.target.value || undefined })} />}
          </Field>
          <Field label="To">
            {(a) => <Input {...a} type="date" value={params.get('to') ?? ''} min={params.get('from') ?? undefined} onChange={(e) => set({ to: e.target.value || undefined })} />}
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <Select aria-label="Sort bookings" className="h-9 !w-auto text-sm" value={query.sort} onChange={(e) => set({ sort: e.target.value })}>
            <option value="start_desc">Latest session first</option>
            <option value="start_asc">Earliest session first</option>
            <option value="created_desc">Most recently booked</option>
          </Select>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setReference('')
                setStudent('')
                setParams(new URLSearchParams(), { replace: true })
              }}
              icon={<X className="size-4" aria-hidden />}
            >
              Clear filters
            </Button>
          )}
        </div>
      </div>

      <div className="mt-6">
        {bookings.isPending ? (
          <Skeleton className="h-96 w-full rounded-[18px]" />
        ) : bookings.isError ? (
          <ErrorState error={bookings.error} onRetry={() => bookings.refetch()} />
        ) : bookings.data.content.length === 0 ? (
          <EmptyState icon={<CalendarPlus className="size-6" aria-hidden />} title="No bookings found" description={hasFilters ? 'Try widening your filters.' : 'Bookings will appear here once students reserve rooms.'} />
        ) : (
          <>
            <p className="mb-3 text-sm text-muted" aria-live="polite">
              {bookings.data.totalElements} booking{bookings.data.totalElements === 1 ? '' : 's'}
            </p>
            {/* Table on wide screens */}
            <div className="hidden overflow-hidden rounded-[18px] border border-line bg-card shadow-soft md:block" style={{ opacity: bookings.isPlaceholderData ? 0.6 : 1 }}>
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wider text-muted">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">Reference</th>
                    <th scope="col" className="px-4 py-3 font-medium">Session</th>
                    <th scope="col" className="px-4 py-3 font-medium">Room</th>
                    <th scope="col" className="px-4 py-3 font-medium">Student</th>
                    <th scope="col" className="px-4 py-3 font-medium">Group</th>
                    <th scope="col" className="px-4 py-3 font-medium">Status</th>
                    <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {bookings.data.content.map((b: Booking) => (
                    <tr key={b.id} className="transition-colors hover:bg-sage-50/60">
                      <td className="px-4 py-3 font-mono font-semibold tracking-wide">{b.bookingReference}</td>
                      <td className="px-4 py-3">
                        <span className="block">{formatDate(datePart(b.startTime), 'short')}</span>
                        <span className="text-xs text-muted">{formatTimeRange(b.startTime, b.endTime)}</span>
                      </td>
                      <td className="px-4 py-3">{b.room.name}</td>
                      <td className="max-w-48 px-4 py-3">
                        <span className="block truncate">{b.owner?.fullName}</span>
                        <span className="block truncate text-xs text-muted">{b.owner?.email}</span>
                      </td>
                      <td className="px-4 py-3">{b.groupSize}</td>
                      <td className="px-4 py-3">
                        <BookingStatusBadge status={b.status} upcoming={new Date(b.endsAt).getTime() > Date.now()} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => setOpenId(b.id)} icon={<Eye className="size-4" aria-hidden />}>
                          View<span className="sr-only"> booking {b.bookingReference}</span>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Cards on small screens */}
            <ul className="space-y-3 md:hidden">
              {bookings.data.content.map((b) => (
                <li key={b.id}>
                  <button type="button" onClick={() => setOpenId(b.id)} className="w-full rounded-[14px] border border-line bg-card p-4 text-left shadow-soft">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-semibold">{b.bookingReference}</span>
                      <BookingStatusBadge status={b.status} upcoming={new Date(b.endsAt).getTime() > Date.now()} />
                    </div>
                    <p className="mt-2 text-sm">
                      {b.room.name} · {formatDate(datePart(b.startTime), 'short')} · {formatTimeRange(b.startTime, b.endTime)}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                      <CalendarCheck className="size-3.5" aria-hidden /> {b.owner?.fullName} · {b.groupSize} students
                    </p>
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <Pagination page={query.page ?? 0} totalPages={bookings.data.totalPages} onChange={(p) => set({ page: String(p + 1) })} label="Booking result pages" />
            </div>
          </>
        )}
      </div>
      {openId !== null && <BookingDetailDialog bookingId={openId} onClose={() => setOpenId(null)} />}
    </>
  )
}
