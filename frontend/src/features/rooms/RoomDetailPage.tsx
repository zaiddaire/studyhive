import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { Accessibility, ArrowRight, ChevronRight, Clock, Info, MapPin, ShieldCheck, Users } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { SmartImage } from '@/components/ui/SmartImage'
import { AmenityIcon } from '@/components/AmenityIcon'
import { Reveal } from '@/components/ui/Motion'
import { useConfig } from '@/hooks/useConfig'
import { ApiError } from '@/lib/api'
import { formatDate, formatDuration, formatTimeRange, isoDayOfWeek, minutesOf, timePart } from '@/lib/time'
import { cn, formatPrice } from '@/lib/utils'
import { publicApi, queryKeys } from '@/services'
import type { AmenityCategory, RoomDetail, Slot } from '@/types/api'
import { SlotPicker, type SlotSelection } from './SlotPicker'

const categoryTitles: Record<AmenityCategory, string> = {
  FACILITY: 'Facilities',
  EQUIPMENT: 'Equipment',
  ACCESSIBILITY: 'Accessibility',
}

function Gallery({ room }: { room: RoomDetail }) {
  const [active, setActive] = useState(0)
  const images = room.images.length ? room.images : [{ url: '', altText: room.name }]
  const current = images[Math.min(active, images.length - 1)]
  return (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-[22px] bg-sage-100 shadow-soft">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={current.url + active} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <SmartImage src={current.url || undefined} alt={current.altText} width={1200} priority className="aspect-[16/10] w-full" />
          </motion.div>
        </AnimatePresence>
        {images.length > 1 && (
          <span className="absolute bottom-3 right-3 rounded-full bg-sage-900/75 px-2.5 py-1 text-xs text-white">
            {active + 1} / {images.length}
          </span>
        )}
      </div>
      {images.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-1" role="group" aria-label="Room photos">
          {images.map((img, i) => (
            <button
              key={img.url + i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Show photo ${i + 1}: ${img.altText}`}
              aria-pressed={i === active}
              className={cn(
                'relative w-28 shrink-0 overflow-hidden rounded-[12px] ring-2 ring-offset-2 ring-offset-canvas transition sm:w-32',
                i === active ? 'ring-sage-700' : 'ring-transparent opacity-70 hover:opacity-100',
              )}
            >
              <SmartImage src={img.url} alt="" width={240} className="aspect-[4/3] w-full" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function HoursTable({ room, highlightDate }: { room: RoomDetail; highlightDate?: string }) {
  const highlight = highlightDate ? isoDayOfWeek(highlightDate) : undefined
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">Opening hours</caption>
      <tbody>
        {room.weeklyHours.map((d) => (
          <tr key={d.dayOfWeek} className={cn('border-b border-line last:border-0', d.dayOfWeek === highlight && 'font-semibold text-sage-800')}>
            <th scope="row" className="py-2.5 text-left font-normal">
              {d.dayName}
            </th>
            <td className="py-2.5 text-right tabular-nums">{d.closed ? <span className="text-muted">Closed</span> : `${timePart(d.openTime!)}–${timePart(d.closeTime!)}`}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function DetailSkeleton() {
  return (
    <div className="container-page py-10" aria-busy>
      <Skeleton className="h-5 w-48" />
      <Skeleton className="mt-6 h-12 w-2/3" />
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_420px]">
        <Skeleton className="aspect-[16/10] w-full rounded-[22px]" />
        <Skeleton className="h-[520px] w-full rounded-[20px]" />
      </div>
    </div>
  )
}

export default function RoomDetailPage() {
  const { id } = useParams()
  const roomId = Number(id)
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { data: config } = useConfig()
  const room = useQuery({ queryKey: queryKeys.room(roomId), queryFn: () => publicApi.room(roomId), enabled: Number.isInteger(roomId) && roomId > 0 })

  const date = params.get('date') ?? config?.today
  const [selection, setSelection] = useState<SlotSelection | null>(null)
  const [slots, setSlots] = useState<Slot[]>([])
  const initialStart = params.get('start')
  const initialDuration = Number(params.get('duration')) || undefined

  // Pre-select the slot carried over from search once availability for that date is known
  // (same query key as the slot picker, so this shares its request and cache).
  const { data: cached } = useQuery({
    queryKey: queryKeys.availability(roomId, date ?? ''),
    queryFn: () => publicApi.availability(roomId, date!),
    enabled: Boolean(date && initialStart),
  })
  useEffect(() => {
    if (!cached || selection || !initialStart) return
    const startIdx = cached.slots.findIndex((s) => timePart(s.start) === initialStart)
    if (startIdx < 0) return
    const count = Math.max(1, Math.round((initialDuration ?? cached.slotDurationMinutes) / cached.slotDurationMinutes))
    const endIdx = startIdx + count - 1
    if (endIdx < cached.slots.length && cached.slots.slice(startIdx, endIdx + 1).every((s) => s.status === 'AVAILABLE')) {
      setSelection({ startIndex: startIdx, endIndex: endIdx })
      setSlots(cached.slots)
    }
  }, [cached, selection, initialStart, initialDuration])

  const grouped = useMemo(() => {
    const out: Partial<Record<AmenityCategory, RoomDetail['amenities']>> = {}
    for (const a of room.data?.amenities ?? []) (out[a.category] ??= []).push(a)
    return out
  }, [room.data])

  if (room.isPending || !config) return <DetailSkeleton />
  if (room.isError) {
    if (room.error instanceof ApiError && room.error.status === 404) {
      return (
        <div className="container-page py-20">
          <EmptyState title="Room not found" description="This room may have been removed." action={<Link className="font-medium text-sage-700 underline" to="/rooms">Browse rooms</Link>} />
        </div>
      )
    }
    return (
      <div className="container-page py-20">
        <ErrorState error={room.error} onRetry={() => room.refetch()} />
      </div>
    )
  }

  const r = room.data
  const range =
    selection && slots[selection.startIndex] && slots[selection.endIndex]
      ? { start: slots[selection.startIndex].start, end: slots[selection.endIndex].end }
      : null
  const minutes = range ? minutesOf(timePart(range.end)) - minutesOf(timePart(range.start)) : 0
  const tooShort = range ? minutes < r.rules.minDurationMinutes : false
  const price = r.hourlyPrice !== undefined && range ? formatPrice((r.hourlyPrice * minutes) / 60) : null

  const changeDate = (d: string) => {
    setSelection(null)
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('date', d)
        next.delete('start')
        next.delete('duration')
        return next
      },
      { replace: true },
    )
  }

  const continueToBook = () => {
    if (!range || !date) return
    const q = new URLSearchParams({ date, start: timePart(range.start), end: timePart(range.end) })
    const size = params.get('size')
    if (size) q.set('size', size)
    navigate(`/rooms/${r.id}/book?${q.toString()}`)
  }

  const bookingPanel = (
    <div className="rounded-[20px] border border-line bg-card p-5 shadow-lift sm:p-6">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="display text-2xl">Check availability</h2>
        {r.hourlyPrice !== undefined && (
          <span className="text-sm text-muted">
            <span className="font-semibold text-ink">{formatPrice(r.hourlyPrice)}</span> / hour
          </span>
        )}
      </div>
      {r.status !== 'ACTIVE' ? (
        <p className="rounded-[12px] bg-warning-soft p-4 text-sm text-warning">This room is not accepting bookings right now. Please choose another room.</p>
      ) : (
        <SlotPicker
          roomId={r.id}
          date={date!}
          onDateChange={changeDate}
          today={config.today}
          advanceDays={r.rules.advanceBookingDays}
          maxDurationMinutes={r.rules.maxDurationMinutes}
          selection={selection}
          onSelectionChange={(sel, s) => {
            setSelection(sel)
            setSlots(s)
          }}
          compact
        />
      )}
      <AnimatePresence>
        {range && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-5 rounded-[14px] bg-sage-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-sage-700">Your selection</p>
              <p className="mt-1 font-serif text-xl">{formatDate(date!, 'medium')}</p>
              <p className="text-sm text-ink">
                {formatTimeRange(range.start, range.end)} · {formatDuration(minutes)}
                {price && <span className="text-muted"> · {price}</span>}
              </p>
              {tooShort && (
                <p className="mt-2 text-xs font-medium text-warning">
                  Minimum booking is {formatDuration(r.rules.minDurationMinutes)} - select one more slot.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <Button size="lg" className="mt-5 w-full" disabled={!range || tooShort || r.status !== 'ACTIVE'} onClick={continueToBook}>
        {range ? 'Continue to book' : 'Select a time to continue'}
        <ArrowRight className="size-4" aria-hidden />
      </Button>
      <p className="mt-3 text-center text-xs text-muted">Nothing is reserved until you confirm in the next step.</p>
    </div>
  )

  return (
    <div className="container-page pb-28 pt-8 lg:pb-24">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted">
        <Link to="/rooms" className="hover:text-sage-700">
          Rooms
        </Link>
        <ChevronRight className="size-4" aria-hidden />
        <span aria-current="page" className="text-ink">
          {r.name}
        </span>
      </nav>

      <header className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="sage">Room {r.roomNumber}</Badge>
            {r.status !== 'ACTIVE' && <Badge tone="warning">Not accepting bookings</Badge>}
          </div>
          <h1 className="display mt-3 text-4xl sm:text-5xl lg:text-6xl">{r.name}</h1>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-4 text-sage-700" aria-hidden /> For groups of {r.minimumCapacity}–{r.maximumCapacity}
            </span>
            {r.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4 text-sage-700" aria-hidden /> {r.location}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-12">
        <div className="min-w-0">
          <Gallery room={r} />
          <div className="mt-8 lg:hidden">{bookingPanel}</div>

          <Reveal className="mt-12">
            <h2 className="display text-3xl">About this room</h2>
            <p className="mt-4 max-w-3xl whitespace-pre-line text-[1.05rem] leading-relaxed text-muted">{r.description}</p>
          </Reveal>

          <Reveal className="mt-12">
            <h2 className="display text-3xl">Amenities & equipment</h2>
            <div className="mt-6 grid gap-8 sm:grid-cols-2">
              {(Object.keys(categoryTitles) as AmenityCategory[]).map((cat) =>
                grouped[cat]?.length ? (
                  <div key={cat}>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">{categoryTitles[cat]}</h3>
                    <ul className="mt-3 space-y-3">
                      {grouped[cat]!.map((a) => (
                        <li key={a.id} className="flex items-start gap-3">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sage-50 text-sage-700">
                            <AmenityIcon code={a.code} />
                          </span>
                          <span>
                            <span className="block text-sm font-medium">{a.name}</span>
                            {a.description && <span className="block text-xs text-muted">{a.description}</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null,
              )}
            </div>
            {r.accessibilityInfo && (
              <div className="mt-8 flex gap-3 rounded-[14px] border border-line bg-card p-4">
                <Accessibility className="mt-0.5 size-5 shrink-0 text-sage-700" aria-hidden />
                <div>
                  <h3 className="text-sm font-semibold">Accessibility</h3>
                  <p className="mt-1 text-sm text-muted">{r.accessibilityInfo}</p>
                </div>
              </div>
            )}
          </Reveal>

          <Reveal className="mt-12 grid gap-8 md:grid-cols-2">
            <div>
              <h2 className="display flex items-center gap-2 text-3xl">
                <Clock className="size-6 text-sage-700" aria-hidden /> Opening hours
              </h2>
              <div className="mt-4 rounded-[14px] border border-line bg-card px-4">
                <HoursTable room={r} highlightDate={date} />
              </div>
              <p className="mt-2 text-xs text-muted">Times in {r.rules.timeZone.replace('_', ' ')} time.</p>
            </div>
            <div>
              <h2 className="display flex items-center gap-2 text-3xl">
                <ShieldCheck className="size-6 text-sage-700" aria-hidden /> Booking rules
              </h2>
              <ul className="mt-4 space-y-3 text-sm">
                {[
                  `The whole room is reserved for your group of ${r.minimumCapacity}–${r.maximumCapacity}.`,
                  `Book in ${r.rules.slotDurationMinutes}-minute slots, from ${formatDuration(r.rules.minDurationMinutes)} up to ${formatDuration(r.rules.maxDurationMinutes)}.`,
                  `Bookings open ${r.rules.advanceBookingDays} days in advance.`,
                  r.rules.cancellationDeadlineMinutes > 0
                    ? `Free cancellation up to ${formatDuration(r.rules.cancellationDeadlineMinutes)} before the start.`
                    : 'You can cancel any time before the session starts.',
                  `Each student can hold up to ${r.rules.maxActiveBookingsPerUser} upcoming bookings.`,
                ].map((rule) => (
                  <li key={rule} className="flex gap-2.5">
                    <Info className="mt-0.5 size-4 shrink-0 text-sage-700" aria-hidden />
                    <span className="text-muted">{rule}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>

        <aside className="hidden lg:block" aria-label="Book this room">
          <div className="sticky top-24">{bookingPanel}</div>
        </aside>
      </div>

      <AnimatePresence>
        {range && !tooShort && (
          <motion.div
            initial={{ y: 80 }}
            animate={{ y: 0 }}
            exit={{ y: 80 }}
            className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 px-4 py-3 shadow-panel backdrop-blur lg:hidden"
          >
            <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{formatDate(date!, 'short')}</p>
                <p className="text-xs text-muted">{formatTimeRange(range.start, range.end)}</p>
              </div>
              <Button onClick={continueToBook}>
                Continue <ArrowRight className="size-4" aria-hidden />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
