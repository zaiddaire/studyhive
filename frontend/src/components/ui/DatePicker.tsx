import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/style.css'
import { CalendarDays } from 'lucide-react'
import { addDays, formatDate, fromPickerDate, toPickerDate } from '@/lib/time'
import { cn } from '@/lib/utils'
import { controlClasses } from './Field'
import type { IsoDate } from '@/types/api'

interface CalendarProps {
  value?: IsoDate
  onChange: (date: IsoDate) => void
  /** First selectable date (server "today"). */
  min: IsoDate
  /** Number of days after min that can be booked. */
  maxDays: number
  className?: string
}

/** Inline calendar limited to the booking window. Dates outside it are disabled, not hidden. */
export function Calendar({ value, onChange, min, maxDays, className }: CalendarProps) {
  const max = addDays(min, maxDays)
  return (
    <DayPicker
      className={className}
      mode="single"
      required
      weekStartsOn={1}
      selected={value ? toPickerDate(value) : undefined}
      onSelect={(d: Date | undefined) => d && onChange(fromPickerDate(d))}
      defaultMonth={value ? toPickerDate(value) : toPickerDate(min)}
      startMonth={toPickerDate(min)}
      endMonth={toPickerDate(max)}
      disabled={[{ before: toPickerDate(min) }, { after: toPickerDate(max) }]}
    />
  )
}

interface DatePickerProps extends Omit<CalendarProps, 'className'> {
  id?: string
  /** Label style on the trigger button; use 'short' in narrow layouts. */
  labelFormat?: 'medium' | 'short'
  placeholder?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

/** A button that opens the calendar in a popover; keyboard and screen-reader accessible via Radix. */
export function DatePicker({ value, onChange, min, maxDays, id, placeholder = 'Choose a date', labelFormat = 'medium', ...aria }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          id={id}
          type="button"
          className={cn(controlClasses, 'flex h-11 items-center gap-2.5 text-left', !value && 'text-subtle')}
          {...aria}
        >
          <CalendarDays className="size-4 shrink-0 text-sage-700" aria-hidden />
          <span className="truncate">{value ? formatDate(value, labelFormat) : placeholder}</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={8}
          collisionPadding={12}
          className="z-50 rounded-[14px] border border-line bg-card p-3 shadow-panel"
        >
          <Calendar
            value={value}
            min={min}
            maxDays={maxDays}
            onChange={(d) => {
              onChange(d)
              setOpen(false)
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
