import type { DayHoursInput } from '@/types/api'
import { cn } from '@/lib/utils'
import { controlClasses } from '@/components/ui/Field'

const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export function toHoursInput(days: { dayOfWeek: number; closed: boolean; openTime?: string; closeTime?: string }[]): DayHoursInput[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = days.find((x) => x.dayOfWeek === i + 1)
    return {
      dayOfWeek: i + 1,
      closed: d?.closed ?? true,
      openTime: d?.openTime?.slice(0, 5) ?? '09:00',
      closeTime: d?.closeTime?.slice(0, 5) ?? '18:00',
    }
  })
}

/** Returns a message for the first invalid row, mirroring the server's checks. */
export function validateHours(days: DayHoursInput[]): string | null {
  for (const d of days) {
    if (d.closed) continue
    if (!d.openTime || !d.closeTime) return `${dayNames[d.dayOfWeek - 1]}: set both opening and closing times.`
    if (d.closeTime <= d.openTime) return `${dayNames[d.dayOfWeek - 1]}: closing time must be after opening time.`
    if (Number(d.openTime.slice(3)) % 15 !== 0 || Number(d.closeTime.slice(3)) % 15 !== 0) return `${dayNames[d.dayOfWeek - 1]}: use quarter-hour times.`
  }
  return null
}

export function WeekHoursEditor({ value, onChange, disabled }: { value: DayHoursInput[]; onChange: (days: DayHoursInput[]) => void; disabled?: boolean }) {
  const patch = (i: number, p: Partial<DayHoursInput>) => onChange(value.map((d, idx) => (idx === i ? { ...d, ...p } : d)))
  return (
    <div className="divide-y divide-line rounded-[14px] border border-line">
      {value.map((d, i) => (
        <fieldset key={d.dayOfWeek} disabled={disabled} className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[140px_auto_1fr]">
          <legend className="sr-only">{dayNames[i]}</legend>
          <span className="text-sm font-medium" aria-hidden>
            {dayNames[i]}
          </span>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" className="size-4 accent-sage-700" checked={!d.closed} onChange={(e) => patch(i, { closed: !e.target.checked })} />
            Open
          </label>
          <div className={cn('col-span-2 flex items-center gap-2 sm:col-span-1', d.closed && 'opacity-40')}>
            <input
              type="time"
              step={900}
              aria-label={`${dayNames[i]} opening time`}
              className={cn(controlClasses, 'h-10 w-32')}
              value={d.openTime ?? ''}
              disabled={d.closed || disabled}
              onChange={(e) => patch(i, { openTime: e.target.value })}
            />
            <span className="text-muted" aria-hidden>
              to
            </span>
            <input
              type="time"
              step={900}
              aria-label={`${dayNames[i]} closing time`}
              className={cn(controlClasses, 'h-10 w-32')}
              value={d.closeTime ?? ''}
              disabled={d.closed || disabled}
              onChange={(e) => patch(i, { closeTime: e.target.value })}
            />
          </div>
        </fieldset>
      ))}
    </div>
  )
}
