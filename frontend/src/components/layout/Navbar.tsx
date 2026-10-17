import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { CalendarDays, LayoutDashboard, LogOut, Menu, Search, Settings2, UserRound, X } from 'lucide-react'
import * as Popover from '@radix-ui/react-popover'
import { toast } from 'sonner'
import { Logo } from '@/components/ui/Logo'
import { ButtonLink, Button } from '@/components/ui/Button'
import { useAuth } from '@/features/auth/AuthProvider'
import { cn, firstName, initials } from '@/lib/utils'

const links = [
  { to: '/rooms', label: 'Explore Rooms' },
  { to: '/#how-it-works', label: 'How It Works' },
  { to: '/about', label: 'About' },
]

function UserMenu() {
  const { user, isAdmin, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  if (!user) return null
  const logout = async () => {
    setOpen(false)
    // Leave protected pages first so their guards don't redirect to the login screen.
    navigate('/')
    await signOut()
    toast.success('You have been logged out.')
  }
  const item = 'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink hover:bg-sage-50'
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full border border-line bg-card py-1 pl-1 pr-3 text-sm font-medium shadow-soft transition hover:border-sage-400"
          aria-label={`Account menu for ${user.fullName}`}
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-sage-700 text-xs font-semibold text-white">
            {initials(user.fullName)}
          </span>
          <span className="hidden max-w-28 truncate lg:inline">{firstName(user.fullName)}</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={10} className="z-50 w-60 rounded-[14px] border border-line bg-card p-2 shadow-panel">
          <div className="border-b border-line px-3 pb-2.5 pt-1.5">
            <p className="truncate text-sm font-semibold">{user.fullName}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <nav className="pt-1.5" onClick={() => setOpen(false)}>
            {isAdmin && (
              <Link to="/admin" className={item}>
                <Settings2 className="size-4 text-sage-700" aria-hidden /> Admin console
              </Link>
            )}
            <Link to="/dashboard" className={item}>
              <LayoutDashboard className="size-4 text-sage-700" aria-hidden /> My dashboard
            </Link>
            <Link to="/rooms" className={item}>
              <CalendarDays className="size-4 text-sage-700" aria-hidden /> Book a room
            </Link>
            <Link to="/profile" className={item}>
              <UserRound className="size-4 text-sage-700" aria-hidden /> Profile
            </Link>
          </nav>
          <button type="button" onClick={logout} className={cn(item, 'mt-1 border-t border-line pt-2.5 text-danger hover:bg-danger-soft')}>
            <LogOut className="size-4" aria-hidden /> Log out
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

export function Navbar({ overlay = false }: { overlay?: boolean }) {
  const { user, isLoading } = useAuth()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => setMobileOpen(false), [location.pathname, location.hash])

  const solid = !overlay || scrolled || mobileOpen
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'relative rounded-md px-3 py-2 text-sm font-medium transition-colors hover:text-sage-700',
      isActive && !location.hash ? 'text-sage-700' : 'text-ink/80',
    )

  return (
    <header
      className={cn(
        'sticky top-0 z-40 transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300',
        solid ? 'border-b border-line/80 bg-canvas/85 shadow-[0_1px_0_rgb(0_0_0/0.02)] backdrop-blur-md' : 'border-b border-transparent bg-transparent',
      )}
    >
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2">
        Skip to content
      </a>
      <div className="container-page flex h-[72px] items-center justify-between gap-4">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={linkClass} end={l.to === '/'}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          {!isLoading && !user && (
            <>
              <ButtonLink to="/login" variant="ghost" size="sm">
                Login
              </ButtonLink>
              <ButtonLink to="/signup" variant="secondary" size="sm">
                Sign Up
              </ButtonLink>
            </>
          )}
          <ButtonLink to="/rooms" size="sm" icon={<Search className="size-4" aria-hidden />}>
            Find a Room
          </ButtonLink>
          {user && <UserMenu />}
        </div>
        <div className="flex items-center gap-2 md:hidden">
          {user && <UserMenu />}
          <Button
            variant="ghost"
            size="sm"
            className="px-2.5"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </Button>
        </div>
      </div>
      <AnimatePresence>
        {mobileOpen && (
          <motion.nav
            id="mobile-nav"
            aria-label="Mobile"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-line bg-canvas md:hidden"
          >
            <div className="container-page flex flex-col gap-1 py-4">
              {links.map((l) => (
                <Link key={l.to} to={l.to} className="rounded-lg px-3 py-3 text-base font-medium hover:bg-sage-50">
                  {l.label}
                </Link>
              ))}
              <div className="mt-3 grid grid-cols-2 gap-2">
                {!user ? (
                  <>
                    <ButtonLink to="/login" variant="secondary">
                      Login
                    </ButtonLink>
                    <ButtonLink to="/signup" variant="secondary">
                      Sign Up
                    </ButtonLink>
                  </>
                ) : (
                  <ButtonLink to="/dashboard" variant="secondary" className="col-span-2">
                    My dashboard
                  </ButtonLink>
                )}
                <ButtonLink to="/rooms" className="col-span-2" icon={<Search className="size-4" aria-hidden />}>
                  Find a Room
                </ButtonLink>
              </div>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  )
}
