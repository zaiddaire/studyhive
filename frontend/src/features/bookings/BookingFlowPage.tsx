import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, ArrowRight, CalendarDays, CircleAlert, Clock, MapPin, ShieldCheck, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Field, FormError, Input, Textarea } from '@/components/ui/Field'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { SmartImage } from '@/components/ui/SmartImage'
import { useConfig } from '@/hooks/useConfig'
import { ApiError } from '@/lib/api'
import { combine, formatDate, formatDuration, formatTimeRange, minutesOf, timePart } from '@/lib/time'
import { formatPrice, newIdempotencyKey } from '@/lib/utils'
import { groupDetailsSchema, type GroupDetailsValues } from '@/schemas/booking'
import { bookingsApi, publicApi, queryKeys } from '@/services'
import type { RoomDetail, Slot } from '@/types/api'
import { SlotPicker, type SlotSelection } from '@/features/rooms/SlotPicker'
import { Stepper } from './Stepper'

const STEPS = ['Time', 'Group details', 'Review & confirm']
const TIME_ERRORS = new Set(['SLOT_TAKEN', 'IN_PAST', 'ROOM_BLOCKED', 'OUTSIDE_OPERATING_HOURS', 'MISALIGNED_TIME', 'ROOM_CLOSED', 'TOO_FAR_AHEAD', 'DURATION_TOO_SHORT', 'DURATION_TOO_LONG', 'USER_DOUBLE_BOOKED'])

function Summary({ room, date, range, group }: { room: RoomDetail; date: string; range: { start: string; end: string } | null; group?: Partial<GroupDetailsValues> }) {
  const minutes = range ? minutesOf(timePart(range.end)) - minutesOf(timePart(range.start)) : 0
  const price = room.hourlyPrice !== undefined && range ? formatPrice((room.hourlyPrice * minutes) / 60) : null
  return (
    <div className="overflow-hidden rounded-[18px] border border-line bg-card shadow-soft">
      <SmartImage src={room.images[0]?.url} alt={room.images[0]?.altText ?? room.name} width={640} className="hidden aspect-[16/9] w-full sm:block" />
      <div className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-sage-700">Room {room.roomNumber}</p>
        <h2 className="display mt-1 text-2xl">{room.name}</h2>
        <dl className="mt-4 space-y-2.5 text-sm">
          {room.location && (
            <div className="flex gap-2.5">
              <dt className="sr-only">Location</dt>
              <MapPin className="mt-0.5 size-4 text-sage-700" aria-hidden />
              <dd className="text-muted">{room.location}</dd>
            </div>
          )}
          <div className="flex gap-2.5">
            <dt className="sr-only">Date</dt>
            <CalendarDays className="mt-0.5 size-4 text-sage-700" aria-hidden />
            <dd>{formatDate(date, 'long')}</dd>
          </div>
          <div className="flex gap-2.5">
            <dt className="sr-only">Time</dt>
            <Clock className="mt-0.5 size-4 text-sage-700" aria-hidden />
            <dd>{range ? `${formatTimeRange(range.start, range.end)} · ${formatDuration(minutes)}` : <span className="text-muted">Choose a time</span>}</dd>
          </div>
          {group?.groupSize && !Number.isNaN(group.groupSize) ? (
            <div className="flex gap-2.5">
              <dt className="sr-only">Group</dt>
              <Users className="mt-0.5 size-4 text-sage-700" aria-hidden />
              <dd>
                {group.groupSize} students{group.groupName ? ` · ${group.groupName}` : ''}
              </dd>
            </div>
          ) : null}
        </dl>
        {price && (
          <div className="mt-4 flex items-center justify-between border-t border-line pt-4 text-sm">
            <span className="text-muted">Estimated cost</span>
            <span className="font-semibold">{price}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function BookingFlowPage() {
  const { id } = useParams()
  const roomId = Number(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [params] = useSearchParams()
  const { data: config } = useConfig()
  const room = useQuery({ queryKey: queryKeys.room(roomId), queryFn: () => publicApi.room(roomId), enabled: roomId > 0 })

  const [step, setStep] = useState(0)
  const [date, setDate] = useState<string | undefined>(params.get('date') ?? undefined)
  const [selection, setSelection] = useState<SlotSelection | null>(null)
  const [slots, setSlots] = useState<Slot[]>([])
  const [banner, setBanner] = useState<string | null>(null)
  const effectiveDate = date ?? config?.today

  // Restore the time chosen on the room page.
  const initialStart = params.get('start')
  const initialEnd = params.get('end')
  const { data: initialAvailability } = useQuery({
    queryKey: queryKeys.availability(roomId, effectiveDate ?? ''),
    queryFn: () => publicApi.availability(roomId, effectiveDate!),
    enabled: Boolean(effectiveDate && initialStart && initialEnd),
  })
  const [restored, setRestored] = useState(false)
  useEffect(() => {
    if (restored || !initialAvailability || !initialStart || !initialEnd) return
    setRestored(true)
    const s = initialAvailability.slots
    const startIndex = s.findIndex((x) => timePart(x.start) === initialStart)
    const endIndex = s.findIndex((x) => timePart(x.end) === initialEnd)
    if (startIndex >= 0 && endIndex >= startIndex && s.slice(startIndex, endIndex + 1).every((x) => x.status === 'AVAILABLE')) {
      setSelection({ startIndex, endIndex })
      setSlots(s)
    } else {
      setBanner('The time you picked is no longer available. Please choose another slot.')
    }
  }, [initialAvailability, initialStart, initialEnd, restored])

  const range = selection && slots[selection.startIndex] && slots[selection.endIndex] ? { start: slots[selection.startIndex].start, end: slots[selection.endIndex].end } : null
  const minutes = range ? minutesOf(timePart(range.end)) - minutesOf(timePart(range.start)) : 0

  // The capacity rule depends on the room, which loads asynchronously; validate against the latest schema.
  const schema = useMemo(() => groupDetailsSchema(room.data?.minimumCapacity ?? 1, room.data?.maximumCapacity ?? 50), [room.data])
  const schemaRef = useRef(schema)
  schemaRef.current = schema
  const sizeParam = Number(params.get('size'))
  const form = useForm<GroupDetailsValues>({
    resolver: (values, context, options) => zodResolver(schemaRef.current)(values, context, options),
    defaultValues: { groupName: '', groupSize: Number.NaN, purpose: '' },
  })
  useEffect(() => {
    if (!room.data || !Number.isNaN(form.getValues('groupSize'))) return
    const fits = Number.isInteger(sizeParam) && sizeParam >= room.data.minimumCapacity && sizeParam <= room.data.maximumCapacity
    form.setValue('groupSize', fits ? sizeParam : room.data.maximumCapacity)
  }, [room.data, sizeParam, form])

  // One key per chosen room/time: retries after a lost response replay the same booking instead of duplicating it.
  const idempotencyKey = useMemo(() => newIdempotencyKey(), [roomId, range?.start, range?.end]) // eslint-disable-line react-hooks/exhaustive-deps

  const mutation = useMutation({
    mutationFn: () => {
      const v = form.getValues()
      return bookingsApi.create(
        {
          roomId,
          startTime: combine(effectiveDate!, timePart(range!.start)),
          endTime: combine(effectiveDate!, timePart(range!.end)),
          groupName: v.groupName || undefined,
          groupSize: v.groupSize,
          purpose: v.purpose || undefined,
        },
        idempotencyKey,
      )
    },
    onSuccess: (booking) => {
      queryClient.setQueryData(queryKeys.booking(booking.id), booking)
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] })
      queryClient.invalidateQueries({ queryKey: ['availability', roomId] })
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
      navigate(`/bookings/${booking.id}?confirmed=1`, { replace: true })
    },
    onError: (error) => {
      if (!(error instanceof ApiError)) return
      if (error.status === 401) {
        toast.error('Your session has ended. Please log in again.')
        navigate(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`)
        return
      }
      if (error.code === 'GROUP_SIZE_OUT_OF_RANGE') {
        form.setError('groupSize', { message: error.message })
        setStep(1)
        return
      }
      if (error.code === 'SLOT_TAKEN') {
        queryClient.invalidateQueries({ queryKey: ['availability', roomId] })
        setSelection(null)
        setBanner(error.message)
        setStep(0)
        toast.error('That time was just booked by another group.')
      }
    },
  })

  if (!config || room.isPending) {
    return (
      <div className="container-page py-10">
        <Skeleton className="h-10 w-80" />
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
          <Skeleton className="h-[520px] rounded-[18px]" />
          <Skeleton className="h-[420px] rounded-[18px]" />
        </div>
      </div>
    )
  }
  if (room.isError) {
    return (
      <div className="container-page py-16">
        <ErrorState error={room.error} onRetry={() => room.refetch()} />
      </div>
    )
  }
  const r = room.data
  if (r.status !== 'ACTIVE') {
    return (
      <div className="container-page py-16">
        <EmptyState title="This room isn’t taking bookings" description="Please choose another room." action={<Link className="font-medium text-sage-700 underline" to="/rooms">Browse rooms</Link>} />
      </div>
    )
  }

  const tooShort = range ? minutes < r.rules.minDurationMinutes : true
  const err = mutation.error instanceof ApiError ? mutation.error : null
  const reviewError =
    err && err.code !== 'SLOT_TAKEN' && err.code !== 'GROUP_SIZE_OUT_OF_RANGE' && err.status !== 401
      ? err.isNetworkError || err.status >= 500
        ? `${err.message} Your booking may not have been saved. It is safe to press “Confirm booking” again - you will never be booked twice.`
        : err.message
      : null

  const goToGroup = () => {
    if (!range || tooShort) return
    setBanner(null)
    setStep(1)
  }

  return (
    <div className="container-page pb-24 pt-8">
      <Link to={`/rooms/${r.id}${effectiveDate ? `?date=${effectiveDate}` : ''}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-sage-700">
        <ArrowLeft className="size-4" aria-hidden /> Back to {r.name}
      </Link>
      <h1 className="display mt-4 text-4xl sm:text-5xl">Book {r.name}</h1>
      <div className="mt-6 max-w-2xl">
        <Stepper steps={STEPS} current={step} />
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <AnimatePresence mode="wait" initial={false}>
            <motion.section
              key={step}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              aria-labelledby={`step-${step}`}
              className="rounded-[20px] border border-line bg-card p-5 shadow-soft sm:p-8"
            >
              {step === 0 && (
                <>
                  <h2 id="step-0" className="display text-3xl">When would you like the room?</h2>
                  <p className="mt-2 text-sm text-muted">Availability is live. Select one slot, or a start and end slot for a longer session.</p>
                  {banner && (
                    <div role="alert" className="mt-5 flex gap-2.5 rounded-[12px] border border-warning/25 bg-warning-soft px-4 py-3 text-sm text-warning">
                      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> {banner}
                    </div>
                  )}
                  <div className="mt-6">
                    <SlotPicker
                      roomId={r.id}
                      date={effectiveDate!}
                      onDateChange={(d) => {
                        setDate(d)
                        setSelection(null)
                      }}
                      today={config.today}
                      advanceDays={r.rules.advanceBookingDays}
                      maxDurationMinutes={r.rules.maxDurationMinutes}
                      selection={selection}
                      onSelectionChange={(sel, s) => {
                        setSelection(sel)
                        setSlots(s)
                      }}
                    />
                  </div>
                  {range && tooShort && (
                    <p className="mt-4 text-sm font-medium text-warning">Minimum booking is {formatDuration(r.rules.minDurationMinutes)}.</p>
                  )}
                  <div className="mt-8 flex justify-end">
                    <Button size="lg" onClick={goToGroup} disabled={!range || tooShort}>
                      Continue <ArrowRight className="size-4" aria-hidden />
                    </Button>
                  </div>
                </>
              )}

              {step === 1 && (
                <form
                  noValidate
                  onSubmit={form.handleSubmit(() => setStep(2))}
                  className="flex flex-col gap-5"
                >
                  <div>
                    <h2 id="step-1" className="display text-3xl">Tell us about your group</h2>
                    <p className="mt-2 text-sm text-muted">
                      {r.name} is for groups of {r.minimumCapacity}–{r.maximumCapacity}. You are booking the whole room on your group’s behalf.
                    </p>
                  </div>
                  <Field label="Number of students" required error={form.formState.errors.groupSize?.message} hint={`Between ${r.minimumCapacity} and ${r.maximumCapacity}, including you.`}>
                    {(a) => <Input {...a} type="number" inputMode="numeric" min={r.minimumCapacity} max={r.maximumCapacity} {...form.register('groupSize', { valueAsNumber: true })} className="max-w-40" />}
                  </Field>
                  <Field label="Group name" error={form.formState.errors.groupName?.message} hint="Optional - e.g. “Thermodynamics study circle”.">
                    {(a) => <Input {...a} maxLength={100} autoComplete="off" {...form.register('groupName')} />}
                  </Field>
                  <Field label="Purpose of the session" error={form.formState.errors.purpose?.message} hint="Optional. Helps administrators understand how rooms are used.">
                    {(a) => <Textarea {...a} maxLength={500} rows={3} {...form.register('purpose')} />}
                  </Field>
                  <div className="mt-2 flex flex-col-reverse justify-between gap-3 sm:flex-row">
                    <Button variant="ghost" onClick={() => setStep(0)}>
                      <ArrowLeft className="size-4" aria-hidden /> Change time
                    </Button>
                    <Button type="submit" size="lg">
                      Review booking <ArrowRight className="size-4" aria-hidden />
                    </Button>
                  </div>
                </form>
              )}

              {step === 2 && range && (
                <div className="flex flex-col gap-6">
                  <div>
                    <h2 id="step-2" className="display text-3xl">Review and confirm</h2>
                    <p className="mt-2 text-sm text-muted">Check the details below. The room is reserved only when you confirm.</p>
                  </div>
                  <dl className="grid gap-x-6 gap-y-4 rounded-[14px] bg-sage-50 p-5 text-sm sm:grid-cols-2">
                    {[
                      ['Room', `${r.name} (${r.roomNumber})`],
                      ['Date', formatDate(effectiveDate!, 'long')],
                      ['Time', `${formatTimeRange(range.start, range.end)} (${formatDuration(minutes)})`],
                      ['Group size', `${form.getValues('groupSize')} students`],
                      ['Group name', form.getValues('groupName') || '—'],
                      ['Purpose', form.getValues('purpose') || '—'],
                      ['Booking reference', 'Issued when you confirm (e.g. SH-7KQ3PA)'],
                      ...(r.hourlyPrice !== undefined ? [['Cost', formatPrice((r.hourlyPrice * minutes) / 60) ?? '—']] : []),
                    ].map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-xs font-medium uppercase tracking-wider text-muted">{k}</dt>
                        <dd className="mt-0.5 break-words font-medium text-ink">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="flex gap-3 rounded-[14px] border border-line p-4 text-sm">
                    <ShieldCheck className="mt-0.5 size-5 shrink-0 text-sage-700" aria-hidden />
                    <div>
                      <p className="font-semibold">Cancellation policy</p>
                      <p className="mt-1 text-muted">
                        {r.rules.cancellationDeadlineMinutes > 0
                          ? `You can cancel free of charge from your dashboard up to ${formatDuration(r.rules.cancellationDeadlineMinutes)} before the session starts.`
                          : 'You can cancel from your dashboard any time before the session starts.'}{' '}
                        Cancelled bookings free the room for other groups.
                      </p>
                    </div>
                  </div>
                  <FormError message={reviewError} />
                  {err && TIME_ERRORS.has(err.code) && err.code !== 'SLOT_TAKEN' && (
                    <Button variant="secondary" onClick={() => setStep(0)}>
                      Choose a different time
                    </Button>
                  )}
                  <div className="flex flex-col-reverse justify-between gap-3 sm:flex-row">
                    <Button variant="ghost" onClick={() => setStep(1)} disabled={mutation.isPending}>
                      <ArrowLeft className="size-4" aria-hidden /> Edit details
                    </Button>
                    <Button size="lg" onClick={() => mutation.mutate()} loading={mutation.isPending}>
                      {mutation.isPending ? 'Confirming…' : 'Confirm booking'}
                    </Button>
                  </div>
                </div>
              )}
            </motion.section>
          </AnimatePresence>
        </div>
        <aside aria-label="Booking summary" className="order-first lg:order-none">
          <div className="lg:sticky lg:top-24">
            <Summary room={r} date={effectiveDate!} range={range} group={step > 0 ? form.watch() : undefined} />
          </div>
        </aside>
      </div>
    </div>
  )
}
