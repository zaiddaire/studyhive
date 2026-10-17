import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { CalendarX, Trash, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import { AdminPageHeader } from '@/components/layout/AdminLayout'
import { Button } from '@/components/ui/Button'
import { Checkbox, Field, FormError, Input, Select } from '@/components/ui/Field'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { Dialog } from '@/components/ui/Dialog'
import { ApiError, errorMessage } from '@/lib/api'
import { formatDateTime, formatDuration } from '@/lib/time'
import { wholeNumber } from '@/schemas/search'
import { adminApi, queryKeys } from '@/services'
import type { BlockedPeriod, BookingSettings, DayHoursInput } from '@/types/api'
import { toHoursInput, validateHours, WeekHoursEditor } from './WeekHoursEditor'

const card = 'rounded-[18px] border border-line bg-card p-6 shadow-soft'

const settingsSchema = z
  .object({
    slotDurationMinutes: z.number(),
    minDurationMinutes: wholeNumber('a minimum duration', 15, 720),
    maxDurationMinutes: wholeNumber('a maximum duration', 15, 720),
    advanceBookingDays: wholeNumber('an advance window', 1, 365),
    cancellationDeadlineMinutes: wholeNumber('a deadline', 0, 10080),
    maxActiveBookingsPerUser: wholeNumber('a limit', 1, 50),
    pricingEnabled: z.boolean(),
  })
  .refine((v) => v.minDurationMinutes % v.slotDurationMinutes === 0, { path: ['minDurationMinutes'], message: 'Must be a whole number of slots.' })
  .refine((v) => v.maxDurationMinutes % v.slotDurationMinutes === 0, { path: ['maxDurationMinutes'], message: 'Must be a whole number of slots.' })
  .refine((v) => v.maxDurationMinutes >= v.minDurationMinutes, { path: ['maxDurationMinutes'], message: 'Must be at least the minimum duration.' })

type SettingsValues = z.infer<typeof settingsSchema>

function SettingsCard() {
  const queryClient = useQueryClient()
  const settings = useQuery({ queryKey: queryKeys.admin.settings, queryFn: adminApi.settings })
  const form = useForm<SettingsValues>({ resolver: zodResolver(settingsSchema) })
  useEffect(() => {
    if (settings.data) form.reset(settings.data)
  }, [settings.data, form])
  const save = useMutation({
    mutationFn: (v: SettingsValues) => adminApi.updateSettings(v as BookingSettings),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.admin.settings, data)
      queryClient.invalidateQueries({ queryKey: queryKeys.config })
      queryClient.invalidateQueries({ queryKey: ['room'] })
      queryClient.invalidateQueries({ queryKey: ['availability'] })
      form.reset(data)
      toast.success('Booking rules saved')
    },
    onError: (error) => {
      if (error instanceof ApiError) for (const f of error.fieldErrors) form.setError(f.field as keyof SettingsValues, { message: f.message })
    },
  })
  const e = form.formState.errors
  const num = (name: keyof SettingsValues) => form.register(name, { valueAsNumber: true })

  return (
    <section className={card} aria-labelledby="rules-heading">
      <h2 id="rules-heading" className="text-lg font-semibold">
        Booking rules
      </h2>
      <p className="mt-1 text-sm text-muted">Applied to every new booking. Existing bookings are not changed.</p>
      {settings.isPending ? (
        <Skeleton className="mt-4 h-72 w-full" />
      ) : settings.isError ? (
        <ErrorState className="mt-4" error={settings.error} onRetry={() => settings.refetch()} />
      ) : (
        <form noValidate onSubmit={form.handleSubmit((v) => save.mutate(v))} className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field label="Slot length" hint="Bookings start and end on these boundaries.">
            {(a) => (
              <Select {...a} {...form.register('slotDurationMinutes', { setValueAs: (v) => Number(v) })}>
                {[15, 30, 60, 90, 120].map((m) => (
                  <option key={m} value={m}>
                    {formatDuration(m)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Advance booking window (days)" error={e.advanceBookingDays?.message}>
            {(a) => <Input {...a} type="number" min={1} max={365} {...num('advanceBookingDays')} />}
          </Field>
          <Field label="Minimum duration (minutes)" error={e.minDurationMinutes?.message}>
            {(a) => <Input {...a} type="number" min={15} step={15} {...num('minDurationMinutes')} />}
          </Field>
          <Field label="Maximum duration (minutes)" error={e.maxDurationMinutes?.message}>
            {(a) => <Input {...a} type="number" min={15} step={15} {...num('maxDurationMinutes')} />}
          </Field>
          <Field label="Cancellation deadline (minutes before start)" error={e.cancellationDeadlineMinutes?.message} hint="0 allows cancelling until the start.">
            {(a) => <Input {...a} type="number" min={0} {...num('cancellationDeadlineMinutes')} />}
          </Field>
          <Field label="Upcoming bookings per student" error={e.maxActiveBookingsPerUser?.message}>
            {(a) => <Input {...a} type="number" min={1} max={50} {...num('maxActiveBookingsPerUser')} />}
          </Field>
          <div className="sm:col-span-2">
            <Checkbox label="Show room prices to students" description="Rooms with an hourly price display an estimated cost. No payment is taken." {...form.register('pricingEnabled')} />
          </div>
          <div className="sm:col-span-2">
            <FormError message={save.isError && !(save.error instanceof ApiError && save.error.fieldErrors.length) ? errorMessage(save.error) : null} />
          </div>
          <div className="flex justify-end sm:col-span-2">
            <Button type="submit" loading={save.isPending} disabled={!form.formState.isDirty}>
              Save rules
            </Button>
          </div>
        </form>
      )}
    </section>
  )
}

function DefaultHoursCard() {
  const queryClient = useQueryClient()
  const hours = useQuery({ queryKey: queryKeys.admin.hours, queryFn: adminApi.hours })
  const [days, setDays] = useState<DayHoursInput[]>([])
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (hours.data) setDays(toHoursInput(hours.data))
  }, [hours.data])
  const save = useMutation({
    mutationFn: () => adminApi.updateHours(days),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.admin.hours, data)
      queryClient.invalidateQueries({ queryKey: queryKeys.config })
      queryClient.invalidateQueries({ queryKey: ['room'] })
      queryClient.invalidateQueries({ queryKey: ['availability'] })
      toast.success('Default hours saved')
    },
  })
  return (
    <section className={card} aria-labelledby="default-hours">
      <h2 id="default-hours" className="text-lg font-semibold">
        Facility opening hours
      </h2>
      <p className="mt-1 text-sm text-muted">Used by every room without custom hours.</p>
      {hours.isPending ? (
        <Skeleton className="mt-4 h-72 w-full" />
      ) : hours.isError ? (
        <ErrorState className="mt-4" error={hours.error} onRetry={() => hours.refetch()} />
      ) : (
        <div className="mt-5 flex flex-col gap-4">
          <WeekHoursEditor value={days} onChange={setDays} />
          <FormError message={error ?? (save.isError ? errorMessage(save.error) : null)} />
          <div className="flex justify-end">
            <Button
              loading={save.isPending}
              onClick={() => {
                const problem = validateHours(days)
                setError(problem)
                if (!problem) save.mutate()
              }}
            >
              Save hours
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}

function BlocksCard() {
  const queryClient = useQueryClient()
  const blocks = useQuery({ queryKey: queryKeys.admin.blocks, queryFn: adminApi.blocks })
  const rooms = useQuery({ queryKey: queryKeys.admin.rooms, queryFn: adminApi.rooms })
  const [roomId, setRoomId] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [reason, setReason] = useState('')
  const [cancelAffected, setCancelAffected] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<BlockedPeriod | null>(null)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.blocks })
    queryClient.invalidateQueries({ queryKey: ['availability'] })
    queryClient.invalidateQueries({ queryKey: ['admin', 'bookings'] })
    queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] })
  }
  const create = useMutation({
    mutationFn: () =>
      adminApi.createBlock({ roomId: roomId ? Number(roomId) : null, startTime: `${start}:00`, endTime: `${end}:00`, reason: reason.trim(), cancelAffectedBookings: cancelAffected }),
    onSuccess: (res) => {
      invalidate()
      const affected = res.affectedBookings.length
      toast.success('Blocked period added', {
        description: affected
          ? res.cancelledCount
            ? `${res.cancelledCount} overlapping booking(s) cancelled.`
            : `${affected} existing booking(s) overlap and were kept - review them in Bookings.`
          : 'No existing bookings were affected.',
      })
      setStart('')
      setEnd('')
      setReason('')
      setCancelAffected(false)
    },
  })
  const remove = useMutation({
    mutationFn: (id: number) => adminApi.deleteBlock(id),
    onSuccess: () => {
      invalidate()
      toast.success('Blocked period removed - those times are bookable again.')
      setToDelete(null)
    },
  })

  const submit = () => {
    if (!start || !end) return setFormError('Choose a start and end.')
    if (end <= start) return setFormError('The end must be after the start.')
    if (reason.trim().length < 3) return setFormError('Give a short reason (shown to administrators and on cancellations).')
    setFormError(null)
    create.mutate()
  }

  return (
    <section className={card} aria-labelledby="blocks-heading">
      <h2 id="blocks-heading" className="flex items-center gap-2 text-lg font-semibold">
        <Wrench className="size-5 text-sage-700" aria-hidden /> Maintenance & events
      </h2>
      <p className="mt-1 text-sm text-muted">Blocked periods make a room (or every room) unbookable. They appear as “Unavailable” in the slot grid.</p>

      <div className="mt-5 grid gap-4 rounded-[14px] bg-canvas p-4 sm:grid-cols-2">
        <Field label="Room">
          {(a) => (
            <Select {...a} value={roomId} onChange={(e) => setRoomId(e.target.value)}>
              <option value="">All rooms</option>
              {rooms.data?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.roomNumber} · {r.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Reason">
          {(a) => <Input {...a} maxLength={255} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Projector repair" />}
        </Field>
        <Field label="Starts">
          {(a) => <Input {...a} type="datetime-local" step={900} value={start} onChange={(e) => setStart(e.target.value)} />}
        </Field>
        <Field label="Ends">
          {(a) => <Input {...a} type="datetime-local" step={900} min={start || undefined} value={end} onChange={(e) => setEnd(e.target.value)} />}
        </Field>
        <div className="sm:col-span-2">
          <Checkbox
            label="Cancel confirmed bookings that overlap this period"
            description="Students see the reason on their cancelled booking. Leave unticked to keep them and follow up manually."
            checked={cancelAffected}
            onChange={(e) => setCancelAffected(e.target.checked)}
          />
        </div>
        <div className="sm:col-span-2">
          <FormError message={formError ?? (create.isError ? errorMessage(create.error) : null)} />
        </div>
        <div className="flex justify-end sm:col-span-2">
          <Button onClick={submit} loading={create.isPending}>
            Add blocked period
          </Button>
        </div>
      </div>

      <h3 className="mt-6 text-sm font-semibold">Current and upcoming</h3>
      {blocks.isPending ? (
        <Skeleton className="mt-3 h-24 w-full" />
      ) : blocks.isError ? (
        <ErrorState className="mt-3" error={blocks.error} onRetry={() => blocks.refetch()} />
      ) : blocks.data.length === 0 ? (
        <EmptyState className="mt-3 py-8" icon={<CalendarX className="size-6" aria-hidden />} title="Nothing blocked" description="All rooms follow their normal hours." />
      ) : (
        <ul className="mt-3 divide-y divide-line rounded-[14px] border border-line">
          {blocks.data.map((b) => (
            <li key={b.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">
                  {b.roomName ? `${b.roomNumber} · ${b.roomName}` : 'All rooms'} — {b.reason}
                </p>
                <p className="text-xs text-muted">
                  {formatDateTime(b.startTime)} → {formatDateTime(b.endTime)}
                  {b.createdByName && ` · added by ${b.createdByName}`}
                </p>
              </div>
              <Button variant="ghost" size="sm" className="self-start text-danger hover:bg-danger-soft sm:self-auto" onClick={() => setToDelete(b)} icon={<Trash className="size-4" aria-hidden />}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
      {toDelete && (
        <Dialog
          open
          onOpenChange={(o) => !o && setToDelete(null)}
          title="Remove this blocked period?"
          description={`${toDelete.reason} · ${formatDateTime(toDelete.startTime)} → ${formatDateTime(toDelete.endTime)}`}
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => setToDelete(null)}>
                Keep
              </Button>
              <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate(toDelete.id)}>
                Remove
              </Button>
            </>
          }
        >
          <p className="text-sm text-muted">The time becomes bookable again. Bookings cancelled because of this block are not restored.</p>
          <FormError message={remove.isError ? errorMessage(remove.error) : null} />
        </Dialog>
      )}
    </section>
  )
}

export default function AdminSchedulePage() {
  return (
    <>
      <AdminPageHeader title="Schedule" description="Opening hours, booking rules and blocked periods for maintenance or events." />
      <div className="grid gap-6 xl:grid-cols-2">
        <SettingsCard />
        <DefaultHoursCard />
      </div>
      <div className="mt-6">
        <BlocksCard />
      </div>
    </>
  )
}
