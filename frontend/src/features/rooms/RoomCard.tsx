import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowUpRight, CircleCheck, CircleX, MapPin, Users } from 'lucide-react'
import { SmartImage } from '@/components/ui/SmartImage'
import { AmenityIcon } from '@/components/AmenityIcon'
import { staggerChild } from '@/components/ui/Motion'
import { cn, formatPrice } from '@/lib/utils'
import type { RoomSummary } from '@/types/api'

export function AvailabilityPill({ availability }: { availability: NonNullable<RoomSummary['availability']> }) {
  const available = availability.status === 'AVAILABLE'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium backdrop-blur',
        available ? 'bg-white/95 text-success' : 'bg-white/95 text-danger',
      )}
    >
      {available ? <CircleCheck className="size-3.5" aria-hidden /> : <CircleX className="size-3.5" aria-hidden />}
      {available ? (availability.freeSlots !== undefined ? availability.message : 'Available') : 'Unavailable'}
    </span>
  )
}

export function RoomCard({ room, linkSearch = '' }: { room: RoomSummary; linkSearch?: string }) {
  const visible = room.amenities.slice(0, 3)
  const extra = room.amenities.length - visible.length
  const price = formatPrice(room.hourlyPrice)
  return (
    <motion.article variants={staggerChild} className="group h-full">
      <Link
        to={`/rooms/${room.id}${linkSearch}`}
        className="flex h-full flex-col overflow-hidden rounded-[16px] border border-line bg-card shadow-soft transition-[transform,box-shadow,border-color] duration-300 ease-out hover:-translate-y-1 hover:border-sage-200 hover:shadow-lift focus-visible:-translate-y-1"
        aria-label={`${room.name}, room ${room.roomNumber}, seats ${room.minimumCapacity} to ${room.maximumCapacity}${room.availability ? `. ${room.availability.message}` : ''}`}
      >
        <div className="relative aspect-[4/3] overflow-hidden">
          <SmartImage
            src={room.coverImage?.url}
            alt={room.coverImage?.altText ?? room.name}
            width={640}
            className="size-full transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          />
          <div className="absolute left-3 top-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-sage-900/80 px-2.5 py-1 text-xs font-semibold tracking-wide text-white backdrop-blur">
              {room.roomNumber}
            </span>
          </div>
          {room.availability && (
            <div className="absolute bottom-3 left-3">
              <AvailabilityPill availability={room.availability} />
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col p-5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="display text-[1.55rem] leading-tight">{room.name}</h3>
            <ArrowUpRight className="mt-1 size-5 shrink-0 text-sage-500 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-4 text-sage-700" aria-hidden />
              {room.minimumCapacity}–{room.maximumCapacity} students
            </span>
            {room.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4 text-sage-700" aria-hidden />
                {room.location}
              </span>
            )}
          </div>
          <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted">{room.summary}</p>
          <div className="mt-auto flex items-center justify-between gap-3 pt-5">
            <ul className="flex items-center gap-1.5" aria-label="Amenities">
              {visible.map((a) => (
                <li key={a.id} title={a.name} className="flex size-8 items-center justify-center rounded-full bg-sage-50 text-sage-700">
                  <AmenityIcon code={a.code} />
                  <span className="sr-only">{a.name}</span>
                </li>
              ))}
              {extra > 0 && (
                <li className="pl-1 text-xs font-medium text-muted">
                  +{extra}
                  <span className="sr-only"> more amenities</span>
                </li>
              )}
            </ul>
            {price ? (
              <span className="text-sm font-semibold text-ink">
                {price}
                <span className="font-normal text-muted"> / hr</span>
              </span>
            ) : (
              <span className="text-sm font-medium text-sage-700">View details</span>
            )}
          </div>
        </div>
      </Link>
    </motion.article>
  )
}

export function RoomCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[16px] border border-line bg-card" aria-hidden>
      <div className="aspect-[4/3] animate-pulse bg-sage-100" />
      <div className="space-y-3 p-5">
        <div className="h-6 w-2/3 animate-pulse rounded bg-sage-100" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-sage-100" />
        <div className="h-4 w-full animate-pulse rounded bg-sage-100" />
        <div className="flex gap-2 pt-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="size-8 animate-pulse rounded-full bg-sage-100" />
          ))}
        </div>
      </div>
    </div>
  )
}
