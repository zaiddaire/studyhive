import { useState } from 'react'
import { formatDayNumber } from '@/lib/time'
import type { Stats } from '@/types/api'

/**
 * Single-series bar chart (magnitude → one sage hue). Thin bars with rounded data ends on a shared baseline,
 * recessive gridlines, a hover/focus tooltip per bar and an equivalent table for screen readers.
 */
export function BookingsNext7Days({ data }: { data: Stats['next7Days'] }) {
  const [active, setActive] = useState<number | null>(null)
  const max = Math.max(1, ...data.map((d) => d.bookings))
  const ticks = [max, Math.round(max / 2), 0].filter((v, i, a) => a.indexOf(v) === i)
  return (
    <figure>
      <div className="relative h-52 pl-8">
        {ticks.map((t) => (
          <div key={t} className="absolute inset-x-0 flex items-center" style={{ bottom: `${(t / max) * 100}%` }} aria-hidden>
            <span className="w-7 -translate-x-8 text-right text-[11px] tabular-nums text-subtle">{t}</span>
            <span className="h-px flex-1 bg-line" />
          </div>
        ))}
        <div className="absolute inset-0 left-8 flex items-end justify-around gap-2" aria-hidden>
          {data.map((d, i) => {
            const pct = (d.bookings / max) * 100
            return (
              <div
                key={d.date}
                className="group relative flex h-full flex-1 cursor-default items-end justify-center"
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
              >
                <div
                  className="w-full max-w-9 rounded-t-[4px] bg-sage-700 transition-[height,opacity] duration-500 ease-out group-hover:opacity-85"
                  style={{ height: d.bookings === 0 ? '2px' : `${pct}%`, opacity: d.bookings === 0 ? 0.35 : 1 }}
                />
                {active === i && (
                  <div className="pointer-events-none absolute z-10 whitespace-nowrap rounded-lg border border-line bg-card px-2.5 py-1.5 text-xs shadow-lift" style={{ bottom: `calc(${Math.max(pct, 1)}% + 6px)` }}>
                    <span className="font-semibold text-ink">{d.bookings}</span>
                    <span className="text-muted"> {d.bookings === 1 ? 'booking' : 'bookings'}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
      <div className="mt-2 flex justify-around gap-2 pl-8" aria-hidden>
        {data.map((d) => {
          const f = formatDayNumber(d.date)
          return (
            <span key={d.date} className="flex-1 text-center text-[11px] leading-tight text-muted">
              {f.weekday}
              <br />
              {f.day} {f.month}
            </span>
          )
        })}
      </div>
      <table className="sr-only">
        <caption>Bookings starting on each of the next 7 days</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Bookings</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <td>{d.date}</td>
              <td>{d.bookings}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

/** Per-room utilisation as labelled horizontal meters (value text in ink, not the bar colour). */
export function RoomUtilizationBars({ rows }: { rows: Stats['roomUtilization'] }) {
  return (
    <ul className="space-y-4">
      {rows.map((r) => (
        <li key={r.roomId} title={`${r.bookedHours} of ${r.openHours} open hours booked`}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">
              <span className="font-medium">{r.name}</span> <span className="text-xs text-muted">{r.roomNumber}</span>
            </span>
            <span className="shrink-0 tabular-nums text-ink">{r.percent === undefined || r.percent === null ? 'No open hours' : `${r.percent}%`}</span>
          </div>
          <div
            className="mt-1.5 h-2 overflow-hidden rounded-full bg-sage-100"
            role="meter"
            aria-label={`${r.name} utilisation`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={r.percent ?? 0}
            aria-valuetext={`${r.percent ?? 0}% - ${r.bookedHours} of ${r.openHours} open hours booked`}
          >
            <div className="h-full rounded-full bg-sage-700 transition-[width] duration-700 ease-out" style={{ width: `${Math.max(0, Math.min(100, r.percent ?? 0))}%` }} />
          </div>
          <p className="mt-1 text-[11px] text-muted">
            {r.bookedHours} h booked of {r.openHours} h open
          </p>
        </li>
      ))}
    </ul>
  )
}
