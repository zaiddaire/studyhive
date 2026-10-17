import { Link } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'

const supportEmail = (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined)?.trim()

export function Footer() {
  const year = new Date().getFullYear()
  const heading = 'mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-sage-100/70'
  const link = 'text-sm text-sage-100/85 transition hover:text-white'
  return (
    <footer className="bg-sage-900 text-sage-100">
      <div className="container-page grid gap-12 py-16 md:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div>
          <Logo inverse />
          <p className="mt-5 max-w-xs font-serif text-xl leading-snug text-white/90">Your group. Your space. Your goals.</p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-sage-100/70">
            Reserve a private room for your study group in a few taps - no more hunting for a free table.
          </p>
        </div>
        <div>
          <h2 className={heading}>Explore</h2>
          <ul className="space-y-2.5">
            <li><Link className={link} to="/rooms">Browse rooms</Link></li>
            <li><Link className={link} to="/#how-it-works">How it works</Link></li>
            <li><Link className={link} to="/#facilities">Facilities</Link></li>
            <li><Link className={link} to="/about">About StudyHive</Link></li>
          </ul>
        </div>
        <div>
          <h2 className={heading}>Account</h2>
          <ul className="space-y-2.5">
            <li><Link className={link} to="/signup">Create an account</Link></li>
            <li><Link className={link} to="/login">Log in</Link></li>
            <li><Link className={link} to="/dashboard">My bookings</Link></li>
          </ul>
        </div>
        <div>
          <h2 className={heading}>Support</h2>
          {supportEmail ? (
            <a className={`${link} inline-flex items-center gap-2`} href={`mailto:${supportEmail}`}>
              <Mail className="size-4" aria-hidden /> {supportEmail}
            </a>
          ) : (
            <p className="text-sm leading-relaxed text-sage-100/75">
              Questions about a room or a booking? Contact your study-space administrator.
            </p>
          )}
          <ul className="mt-5 space-y-2.5">
            <li><Link className={link} to="/privacy">Privacy policy</Link></li>
            <li><Link className={link} to="/terms">Terms of use</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-2 py-6 text-xs text-sage-100/60 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} StudyHive. All rights reserved.</p>
          <p>Times are shown in the facility’s local time zone.</p>
        </div>
      </div>
    </footer>
  )
}
