import { useQuery } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowRight, CalendarClock, DoorOpen, Lightbulb, Search, Target, Users, UsersRound } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'
import { SmartImage } from '@/components/ui/SmartImage'
import { Reveal, staggerChild, staggerParent } from '@/components/ui/Motion'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { AmenityIcon } from '@/components/AmenityIcon'
import { LogoMark } from '@/components/ui/Logo'
import { RoomCard, RoomCardSkeleton } from '@/features/rooms/RoomCard'
import { useAuth } from '@/features/auth/AuthProvider'
import { useAmenities } from '@/hooks/useConfig'
import { publicApi, queryKeys } from '@/services'
import { QuickSearch } from './QuickSearch'

const HERO_IMAGE = 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f'
const BENEFITS_IMAGE = 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d'
const ease = [0.22, 1, 0.36, 1] as const
const categoryOrder = ['FACILITY', 'EQUIPMENT', 'ACCESSIBILITY']

function Hero() {
  const reduce = useReducedMotion()
  const fade = (delay: number) =>
    reduce ? {} : { initial: { opacity: 0, y: 22 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.8, delay, ease } }
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="honeycomb-bg pointer-events-none absolute inset-y-0 right-0 w-2/3 opacity-60 [mask-image:linear-gradient(to_left,black,transparent)]" />
      <div className="container-page relative grid items-center gap-12 pb-16 pt-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pb-24 lg:pt-16">
        <div>
          <motion.p {...fade(0)} className="eyebrow inline-flex items-center gap-2">
            <span className="h-px w-8 bg-champagne-400" aria-hidden />
            Group study rooms
          </motion.p>
          <motion.h1 {...fade(0.08)} className="display mt-6 text-[2.75rem] leading-[1.02] sm:text-6xl lg:text-[4.6rem]">
            Good ideas grow when we <em className="text-sage-700">study together.</em>
          </motion.h1>
          <motion.p {...fade(0.18)} className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
            Find the perfect space for your study group. Reserve a room, bring your people, and make every session count.
          </motion.p>
          <motion.div {...fade(0.28)} className="mt-9 flex flex-col gap-3 sm:flex-row">
            <ButtonLink to="/rooms" size="lg" icon={<Search className="size-[18px]" aria-hidden />}>
              Find Your Study Room
            </ButtonLink>
            <ButtonLink to="/#how-it-works" size="lg" variant="secondary">
              How It Works
            </ButtonLink>
          </motion.div>
        </div>
        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.1, ease }}
          className="relative"
        >
          <div className="relative overflow-hidden rounded-[28px] shadow-panel ring-1 ring-black/5">
            <SmartImage
              src={HERO_IMAGE}
              alt="A group of students studying together around a shared table with laptops and notebooks"
              width={1100}
              priority
              className="aspect-[4/3] w-full sm:aspect-[5/4] lg:aspect-[4/5]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-sage-900/35 via-transparent to-transparent" aria-hidden />
          </div>
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.6, ease }}
            className="absolute -bottom-5 left-4 flex items-center gap-3 rounded-[16px] border border-line bg-card/95 px-4 py-3 shadow-lift backdrop-blur sm:-left-6 sm:bottom-8"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-sage-100 text-sage-700">
              <DoorOpen className="size-5" aria-hidden />
            </span>
            <span>
              <span className="block text-sm font-semibold">The whole room is yours</span>
              <span className="block text-xs text-muted">Private, bookable by the hour</span>
            </span>
          </motion.div>
          <div aria-hidden className="absolute -right-3 -top-3 hidden size-20 rotate-12 rounded-[18px] border border-champagne-400/50 bg-champagne-100/70 sm:block" />
        </motion.div>
      </div>
    </section>
  )
}

function SearchPanel() {
  return (
    <section aria-labelledby="quick-search" className="container-page relative z-10 -mt-2 lg:-mt-8">
      <Reveal>
        <div className="rounded-[20px] border border-line bg-card p-5 shadow-panel sm:p-7">
          <h2 id="quick-search" className="display mb-5 text-2xl">
            Find a room for your group
          </h2>
          <QuickSearch />
        </div>
      </Reveal>
    </section>
  )
}

function FeaturedRooms() {
  const rooms = useQuery({ queryKey: queryKeys.rooms({ size: 3, sort: 'capacity_desc' }), queryFn: () => publicApi.rooms({ size: 3, sort: 'capacity_desc' }) })
  return (
    <section aria-labelledby="featured" className="container-page py-24">
      <Reveal className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">Featured rooms</p>
          <h2 id="featured" className="display mt-3 text-4xl sm:text-5xl">
            Rooms built for groups
          </h2>
          <p className="mt-3 max-w-xl text-muted">Each room is booked as a whole, so the table, the whiteboard and the quiet are all yours.</p>
        </div>
        <ButtonLink to="/rooms" variant="secondary" className="self-start sm:self-auto">
          Browse all rooms <ArrowRight className="size-4" aria-hidden />
        </ButtonLink>
      </Reveal>
      <div className="mt-12">
        {rooms.isPending ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <RoomCardSkeleton key={i} />
            ))}
          </div>
        ) : rooms.isError ? (
          <ErrorState error={rooms.error} onRetry={() => rooms.refetch()} title="Rooms are unavailable right now" />
        ) : rooms.data.content.length === 0 ? (
          <EmptyState title="No rooms yet" description="Rooms will appear here as soon as an administrator adds them." />
        ) : (
          <motion.div
            className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
            variants={staggerParent}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
          >
            {rooms.data.content.map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </motion.div>
        )}
      </div>
    </section>
  )
}

const steps = [
  { icon: Search, title: 'Find your room', text: 'Filter by group size, facilities and date to see which rooms are free - straight from live bookings.' },
  { icon: CalendarClock, title: 'Choose your time slot', text: 'Pick a start time and how long you need. The room is held for your group the moment you confirm.' },
  { icon: UsersRound, title: 'Study together', text: 'Bring your people. Your booking reference and details live in your dashboard until the session.' },
]

function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-title" className="scroll-mt-24 border-y border-line bg-card">
      <div className="container-page py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">How it works</p>
          <h2 id="how-title" className="display mt-3 text-4xl sm:text-5xl">
            Three steps to a room of your own
          </h2>
        </Reveal>
        <div className="relative mt-16">
          <div aria-hidden className="absolute left-[16%] right-[16%] top-9 hidden border-t border-dashed border-line-strong md:block" />
          <motion.ol
            className="relative grid gap-10 md:grid-cols-3 md:gap-8"
            variants={staggerParent}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
          >
          {steps.map((step, i) => (
            <motion.li key={step.title} variants={staggerChild} className="relative flex flex-col items-center text-center">
              <div className="relative flex size-[72px] items-center justify-center">
                <svg viewBox="0 0 72 72" className="absolute inset-0 size-full" aria-hidden>
                  <path d="M36 3 64.6 19.5v33L36 69 7.4 52.5v-33Z" fill="#F3F6F1" stroke="#D3DDCF" strokeWidth="1.5" />
                </svg>
                <step.icon className="relative size-7 text-sage-700" aria-hidden />
                <span className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-champagne-400 text-xs font-bold text-sage-900">
                  {i + 1}
                </span>
              </div>
              <h3 className="display mt-6 text-2xl">{step.title}</h3>
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">{step.text}</p>
            </motion.li>
          ))}
          </motion.ol>
        </div>
      </div>
    </section>
  )
}

function Facilities() {
  const amenities = useAmenities()
  return (
    <section id="facilities" aria-labelledby="facilities-title" className="container-page scroll-mt-24 py-24">
      <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <Reveal>
          <p className="eyebrow">Facilities & amenities</p>
          <h2 id="facilities-title" className="display mt-3 text-4xl sm:text-5xl">
            Everything a good session needs
          </h2>
          <p className="mt-4 max-w-md leading-relaxed text-muted">
            Every room lists exactly what it offers, so you can filter for a display screen, a whiteboard wall or step-free access before you book.
          </p>
          <ButtonLink to="/rooms" variant="secondary" className="mt-8">
            Filter rooms by amenity <ArrowRight className="size-4" aria-hidden />
          </ButtonLink>
        </Reveal>
        <div>
          {amenities.isPending ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-[14px]" />
              ))}
            </div>
          ) : amenities.isError ? (
            <ErrorState error={amenities.error} onRetry={() => amenities.refetch()} />
          ) : (
            <motion.ul
              className="grid grid-cols-2 gap-3 sm:grid-cols-3"
              variants={staggerParent}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-60px' }}
            >
              {[...amenities.data]
                .sort((a, b) => categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category))
                .map((a) => (
                <motion.li
                  key={a.id}
                  variants={staggerChild}
                  className="flex items-start gap-3 rounded-[14px] border border-line bg-card p-4 transition-colors hover:border-sage-200"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sage-50 text-sage-700">
                    <AmenityIcon code={a.code} />
                  </span>
                  <span>
                    <span className="block text-sm font-medium">{a.name}</span>
                    {a.description && <span className="mt-0.5 block text-xs leading-snug text-muted">{a.description}</span>}
                  </span>
                </motion.li>
              ))}
            </motion.ul>
          )}
        </div>
      </div>
    </section>
  )
}

const benefits = [
  { icon: Lightbulb, title: 'Teach it to own it', text: 'Explaining an idea to your group is one of the surest ways to understand it yourself.' },
  { icon: Target, title: 'Momentum, together', text: 'A booked time and a shared table make it easier to start - and much harder to drift.' },
  { icon: Users, title: 'Room to think out loud', text: 'Whiteboards, screens and a door that closes: discuss freely without disturbing anyone.' },
]

function Benefits() {
  return (
    <section aria-labelledby="benefits-title" className="bg-sage-50/70">
      <div className="container-page grid items-center gap-14 py-24 lg:grid-cols-2">
        <Reveal className="relative">
          <SmartImage
            src={BENEFITS_IMAGE}
            alt="Students collaborating around laptops in a bright study room"
            width={900}
            className="aspect-[5/4] w-full rounded-[24px] shadow-lift"
          />
          <div className="absolute -bottom-6 -right-2 hidden rounded-[16px] bg-sage-700 px-5 py-4 text-white shadow-lift sm:block">
            <p className="font-serif text-2xl leading-none">Your group.</p>
            <p className="mt-1 text-sm text-sage-100">Your space. Your goals.</p>
          </div>
        </Reveal>
        <div>
          <Reveal>
            <p className="eyebrow">Why study together</p>
            <h2 id="benefits-title" className="display mt-3 text-4xl sm:text-5xl">
              Better together, with a room that fits
            </h2>
          </Reveal>
          <ul className="mt-10 space-y-7">
            {benefits.map((b, i) => (
              <li key={b.title}>
                <Reveal delay={i * 0.08} className="flex gap-5">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-[14px] border border-line bg-card text-sage-700 shadow-soft">
                    <b.icon className="size-5" aria-hidden />
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold">{b.title}</h3>
                    <p className="mt-1 leading-relaxed text-muted">{b.text}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

function CallToAction() {
  const { user } = useAuth()
  return (
    <section className="container-page py-24">
      <Reveal>
        <div className="honeycomb-bg relative overflow-hidden rounded-[28px] bg-sage-800 px-6 py-16 text-center sm:px-12 sm:py-20">
          <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(198,168,120,0.25),transparent_60%)]" />
          <div className="relative">
            <LogoMark inverse className="mx-auto size-12" />
            <h2 className="display mx-auto mt-6 max-w-2xl text-4xl !text-white sm:text-5xl">Your group. Your space. Your goals.</h2>
            <p className="mx-auto mt-4 max-w-xl text-sage-100/85">Pick a date, choose a room, and your study session is on the calendar.</p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <ButtonLink to="/rooms" variant="inverse" size="lg">
                Find your study room
              </ButtonLink>
              {!user && (
                <ButtonLink to="/signup" variant="accent" size="lg">
                  Create a free account
                </ButtonLink>
              )}
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  )
}

export function LandingPage() {
  return (
    <>
      <Hero />
      <SearchPanel />
      <FeaturedRooms />
      <HowItWorks />
      <Facilities />
      <Benefits />
      <CallToAction />
    </>
  )
}
