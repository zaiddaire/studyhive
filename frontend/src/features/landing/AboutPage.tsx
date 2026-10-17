import { CalendarCheck, DoorOpen, ShieldCheck, Users } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'
import { Reveal } from '@/components/ui/Motion'
import { SmartImage } from '@/components/ui/SmartImage'

const principles = [
  { icon: DoorOpen, title: 'A whole room, not a seat', text: 'StudyHive reserves an entire private room for one group, so you can talk, sketch on the whiteboard and share a screen without disturbing anyone.' },
  { icon: CalendarCheck, title: 'Availability you can trust', text: 'Every free slot you see comes from live bookings. The server checks each reservation as it is made, so two groups can never hold the same room at the same time.' },
  { icon: Users, title: 'Built for groups of six to eight', text: 'Rooms list their real capacity and facilities. Choose the space that fits the people you study with.' },
  { icon: ShieldCheck, title: 'Private by design', text: 'We store only what is needed to run your bookings: your name, email and reservations. Passwords are hashed and never visible to anyone.' },
]

export default function AboutPage() {
  return (
    <div className="pb-24">
      <section className="container-page grid items-center gap-12 pt-14 lg:grid-cols-2">
        <Reveal>
          <p className="eyebrow">About StudyHive</p>
          <h1 className="display mt-4 text-5xl leading-[1.05] sm:text-6xl">A calmer way to study together.</h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
            Finding a quiet place where a whole group can work together shouldn’t take longer than the session itself. StudyHive makes group study rooms
            easy to discover, fair to book and simple to manage.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink to="/rooms" size="lg">
              Explore rooms
            </ButtonLink>
            <ButtonLink to="/#how-it-works" variant="secondary" size="lg">
              How it works
            </ButtonLink>
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <SmartImage
            src="https://images.unsplash.com/photo-1552664730-d307ca884978"
            alt="A group planning ideas on a wall of sticky notes"
            width={900}
            className="aspect-[4/3] w-full rounded-[24px] shadow-lift"
          />
        </Reveal>
      </section>
      <section className="container-page mt-24" aria-labelledby="principles">
        <Reveal>
          <h2 id="principles" className="display text-4xl">
            What we believe
          </h2>
        </Reveal>
        <ul className="mt-10 grid gap-6 md:grid-cols-2">
          {principles.map((p, i) => (
            <li key={p.title}>
              <Reveal delay={i * 0.06} className="h-full rounded-[18px] border border-line bg-card p-7 shadow-soft">
                <p.icon className="size-6 text-sage-700" aria-hidden />
                <h3 className="display mt-4 text-2xl">{p.title}</h3>
                <p className="mt-2 leading-relaxed text-muted">{p.text}</p>
              </Reveal>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
