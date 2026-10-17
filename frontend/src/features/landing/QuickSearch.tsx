import { useEffect, useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { Minus, Plus, Search } from 'lucide-react'
import { Field, Select } from '@/components/ui/Field'
import { DatePicker } from '@/components/ui/DatePicker'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Feedback'
import { useConfig } from '@/hooks/useConfig'
import { quickSearchSchema, type QuickSearchValues } from '@/schemas/search'
import { durationOptions, hoursForDate, startTimeOptions } from '@/lib/booking'
import { formatDuration } from '@/lib/time'
import { controlClasses } from '@/components/ui/Field'
import { cn } from '@/lib/utils'

/** Landing-page search: validates the criteria and opens the live room list for that slot. */
export function QuickSearch() {
  const navigate = useNavigate()
  const { data: config, isPending } = useConfig()

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<QuickSearchValues>({
    resolver: zodResolver(quickSearchSchema),
    defaultValues: { date: '', start: '', duration: Number.NaN, groupSize: 6 },
  })

  const date = watch('date')
  const starts = useMemo(() => {
    if (!config) return []
    return startTimeOptions(hoursForDate(config.defaultHours, date), config.slotDurationMinutes, config.minDurationMinutes, date, config.serverTime)
  }, [config, date])

  useEffect(() => {
    if (!config) return
    if (!getValues('date')) setValue('date', config.today)
    if (Number.isNaN(getValues('duration'))) setValue('duration', Math.max(config.minDurationMinutes, Math.min(120, config.maxDurationMinutes)))
  }, [config, getValues, setValue])

  useEffect(() => {
    const current = getValues('start')
    if (current && !starts.includes(current)) setValue('start', '')
  }, [starts, getValues, setValue])

  const onSubmit = (v: QuickSearchValues) => {
    const params = new URLSearchParams({ date: v.date, size: String(v.groupSize) })
    if (v.start) {
      params.set('start', v.start)
      params.set('duration', String(v.duration))
    }
    navigate(`/rooms?${params.toString()}`)
  }

  if (isPending || !config) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_1fr_auto]" aria-busy>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-11 w-full" />
          </div>
        ))}
        <Skeleton className="h-11 w-full self-end lg:w-40" />
      </div>
    )
  }

  const groupSize = watch('groupSize')
  const step = (delta: number) => {
    const next = Math.min(50, Math.max(1, (Number.isNaN(groupSize) ? 0 : groupSize) + delta))
    setValue('groupSize', next, { shouldValidate: true })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate aria-label="Find a study room" className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_1fr_auto]">
      <Field label="Date" error={errors.date?.message}>
        {(a) => (
          <Controller
            control={control}
            name="date"
            render={({ field }) => (
              <DatePicker {...a} value={field.value || undefined} onChange={field.onChange} min={config.today} maxDays={config.advanceBookingDays} />
            )}
          />
        )}
      </Field>
      <Field label="Start time" error={errors.start?.message}>
        {(a) => (
          <Select {...a} {...register('start')} disabled={starts.length === 0}>
            <option value="">{starts.length === 0 ? (date ? 'No times left this day' : 'Choose a date first') : 'Any time'}</option>
            {starts.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Duration" error={errors.duration?.message}>
        {(a) => (
          <Select {...a} {...register('duration', { setValueAs: (v) => Number(v) })}>
            {durationOptions(config.minDurationMinutes, config.maxDurationMinutes, config.slotDurationMinutes).map((d) => (
              <option key={d} value={d}>
                {formatDuration(d)}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Group size" error={errors.groupSize?.message}>
        {(a) => (
          <div className={cn(controlClasses, 'flex h-11 items-center gap-1 px-1.5')}>
            <button type="button" onClick={() => step(-1)} className="rounded-md p-1.5 text-muted hover:bg-sage-50 hover:text-ink" aria-label="Fewer students">
              <Minus className="size-4" aria-hidden />
            </button>
            <input
              {...a}
              {...register('groupSize', { valueAsNumber: true })}
              type="number"
              inputMode="numeric"
              min={1}
              max={50}
              className="w-full bg-transparent text-center outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button type="button" onClick={() => step(1)} className="rounded-md p-1.5 text-muted hover:bg-sage-50 hover:text-ink" aria-label="More students">
              <Plus className="size-4" aria-hidden />
            </button>
          </div>
        )}
      </Field>
      <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
        <span className="hidden text-sm font-medium lg:block" aria-hidden>
          &nbsp;
        </span>
        <Button type="submit" size="md" className="w-full lg:w-auto lg:px-6" icon={<Search className="size-4" aria-hidden />}>
          Search rooms
        </Button>
      </div>
      <p className="text-xs text-muted sm:col-span-2 lg:col-span-5">
        Book up to {config.advanceBookingDays} days ahead. Leave the start time as “Any time” to see every free slot that day. Times are
        shown in {config.timeZone.replace('_', ' ')} time.
      </p>
    </form>
  )
}
