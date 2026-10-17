import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { CalendarClock, CalendarRange, DoorOpen, ExternalLink, Gauge, LogOut, Menu, Users, X } from 'lucide-react'
import { toast } from 'sonner'
import { Logo } from '@/components/ui/Logo'
import { AnimatedOutlet } from '@/components/ui/Motion'
import { useAuth } from '@/features/auth/AuthProvider'
import { cn, initials } from '@/lib/utils'

const nav = [
  { to: '/admin', label: 'Overview', icon: Gauge, end: true },
  { to: '/admin/rooms', label: 'Rooms', icon: DoorOpen },
  { to: '/admin/bookings', label: 'Bookings', icon: CalendarRange },
  { to: '/admin/schedule', label: 'Schedule', icon: CalendarClock },
  { to: '/admin/users', label: 'Users', icon: Users },
]

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const logout = async () => {
    navigate('/')
    await signOut()
    toast.success('You have been logged out.')
  }
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-5 pb-6 pt-6">
        <Logo to="/admin" inverse label="StudyHive admin overview" />
        <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-champagne-400">
          Admin
        </span>
      </div>
      <nav aria-label="Admin" className="flex flex-1 flex-col gap-1 px-3">
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-colors',
                isActive ? 'bg-white/10 text-white' : 'text-sage-100/75 hover:bg-white/5 hover:text-white',
              )
            }
          >
            <Icon className="size-[18px]" aria-hidden />
            {label}
          </NavLink>
        ))}
        <NavLink to="/" onClick={onNavigate} className="mt-4 flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm text-sage-100/75 hover:bg-white/5 hover:text-white">
          <ExternalLink className="size-[18px]" aria-hidden /> View public site
        </NavLink>
      </nav>
      <div className="m-3 rounded-[12px] border border-white/10 bg-white/5 p-3">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-champagne-400 text-xs font-semibold text-sage-900">
            {initials(user?.fullName)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{user?.fullName}</p>
            <p className="truncate text-xs text-sage-100/60">{user?.email}</p>
          </div>
        </div>
        <button type="button" onClick={logout} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm text-sage-100/85 hover:bg-white/10 hover:text-white">
          <LogOut className="size-4" aria-hidden /> Log out
        </button>
      </div>
    </div>
  )
}

export function AdminLayout() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  useEffect(() => setOpen(false), [location.pathname])

  return (
    <div className="min-h-dvh bg-canvas lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 hidden h-dvh bg-sage-900 lg:block">
        <SidebarContent />
      </aside>
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-line bg-sage-900 px-4 lg:hidden">
        <Logo to="/admin" inverse label="StudyHive admin overview" />
        <button
          type="button"
          className="rounded-lg p-2 text-white hover:bg-white/10"
          aria-label="Open admin menu"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <Menu className="size-5" aria-hidden />
        </button>
      </header>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-sage-900/40 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] bg-sage-900 lg:hidden"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              role="dialog"
              aria-modal="true"
              aria-label="Admin menu"
            >
              <button
                type="button"
                className="absolute right-3 top-5 rounded-lg p-2 text-white hover:bg-white/10"
                aria-label="Close admin menu"
                onClick={() => setOpen(false)}
              >
                <X className="size-5" aria-hidden />
              </button>
              <SidebarContent onNavigate={() => setOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
      <main id="main" className="min-w-0 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
        <AnimatedOutlet />
      </main>
    </div>
  )
}

export function AdminPageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="display text-3xl sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
