import { useEffect, useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Checkbox, Field, Input, Select } from '@/components/ui/Field'
import { DatePicker } from '@/components/ui/DatePicker'
import { Skeleton } from '@/components/ui/Feedback'
import { useAmenities, useConfig } from '@/hooks/useConfig'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { durationOptions, hoursForDate, startTimeOptions } from '@/lib/booking'
import { formatDuration } from '@/lib/time'
import type { AmenityCategory } from '@/types/api'
import type { RoomFilters } from './useRoomFilters'

const categoryLabels: Record<AmenityCategory, string> = {
  FACILITY: 'Facilities',
  EQUIPMENT: 'Equipment',
  ACCESSIBILITY: 'Accessibility',
}

interface Props {
  filters: RoomFilters
  update: (patch: Partial<RoomFilters>) => void
}

export function RoomFiltersPanel({ filters, update }: Props) {
  const { data: config } = useConfig()
  const amenities = useAmenities()
  const [query, setQuery] = useState(filters.q)
  const debounced = useDebouncedValue(query, 350)

  useEffect(() => {
    if (debounced !== filters.q) update({ q: debounced })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  useEffect(() => setQuery(filters.q), [filters.q])

  const starts = useMemo(() => {
    if (!config || !filters.date) return []
    return startTimeOptions(hoursForDate(config.defaultHours, filters.date), config.slotDurationMinutes, config.minDurationMinutes, filters.date, config.serverTime)
  }, [config, filters.date])

  const grouped = useMemo(() => {
    const groups: Partial<Record<AmenityCategory, NonNullable<typeof amenities.data>>> = {}
    for (const a of amenities.data ?? []) (groups[a.category] ??= []).push(a)
    return groups
  }, [amenities.data])

  const toggleAmenity = (code: string) => {
    const next = filters.amenities.includes(code) ? filters.amenities.filter((c) => c !== code) : [...filters.amenities, code]
    update({ amenities: next })
  }

  return (
    <div className="flex flex-col gap-6">
      <Field label="Search">
        {(a) => (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <Input {...a} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Room name or number" className="pl-10" />
          </div>
        )}
      </Field>

      <fieldset className="flex flex-col gap-4 rounded-[14px] border border-line bg-canvas/60 p-4">
        <legend className="px-1 text-sm font-semibold">When</legend>
        {config ? (
          <>
            <Field label="Date">
              {(a) => (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <DatePicker {...a} value={filters.date} onChange={(date) => update({ date })} min={config.today} maxDays={config.advanceBookingDays} />
                  </div>
                  {filters.date && (
                    <button type="button" onClick={() => update({ date: undefined })} className="rounded-[10px] border border-line px-3 text-muted hover:text-ink" aria-label="Clear date">
                      <X className="size-4" aria-hidden />
                    </button>
                  )}
                </div>
              )}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start">
                {(a) => (
                  <Select {...a} value={filters.start ?? ''} disabled={!filters.date || starts.length === 0} onChange={(e) => update({ start: e.target.value || undefined, duration: e.target.value ? (filters.duration ?? config.minDurationMinutes) : undefined })}>
                    <option value="">Any time</option>
                    {starts.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Duration">
                {(a) => (
                  <Select {...a} value={filters.duration ?? config.minDurationMinutes} disabled={!filters.start} onChange={(e) => update({ duration: Number(e.target.value) })}>
                    {durationOptions(config.minDurationMinutes, config.maxDurationMinutes, config.slotDurationMinutes).map((d) => (
                      <option key={d} value={d}>
                        {formatDuration(d)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            <Checkbox
              label="Only show rooms I can book"
              description={filters.date ? 'Based on live bookings for your chosen time.' : 'Choose a date to use this filter.'}
              checked={filters.availableOnly}
              disabled={!filters.date}
              onChange={(e) => update({ availableOnly: e.target.checked })}
            />
          </>
        ) : (
          <Skeleton className="h-32 w-full" />
        )}
      </fieldset>

      <Field label="Group size" hint="Shows rooms that fit your whole group.">
        {(a) => (
          <Input
            {...a}
            type="number"
            inputMode="numeric"
            min={1}
            max={50}
            placeholder="e.g. 6"
            value={filters.groupSize ?? ''}
            onChange={(e) => {
              const n = Number(e.target.value)
              update({ groupSize: e.target.value && Number.isInteger(n) && n > 0 && n <= 50 ? n : undefined })
            }}
          />
        )}
      </Field>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Amenities</legend>
        {amenities.isPending ? (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-5 w-40" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {(Object.keys(categoryLabels) as AmenityCategory[]).map((cat) =>
              grouped[cat]?.length ? (
                <div key={cat}>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted">{categoryLabels[cat]}</p>
                  {grouped[cat]!.map((a) => (
                    <Checkbox key={a.code} label={a.name} checked={filters.amenities.includes(a.code)} onChange={() => toggleAmenity(a.code)} />
                  ))}
                </div>
              ) : null,
            )}
          </div>
        )}
      </fieldset>
    </div>
  )
}
