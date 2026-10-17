import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Navbar } from './Navbar'
import { Footer } from './Footer'
import { AnimatedOutlet } from '@/components/ui/Motion'

/** Scrolls to #hash targets after navigation, otherwise to the top of each new page. */
export function ScrollManager() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) {
      const id = decodeURIComponent(hash.slice(1))
      const timer = window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
      return () => window.clearTimeout(timer)
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior })
    return undefined
  }, [pathname, hash])
  return null
}

export function PublicLayout() {
  const { pathname } = useLocation()
  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar overlay={pathname === '/'} />
      <main id="main" className="flex-1">
        <AnimatedOutlet />
      </main>
      <Footer />
    </div>
  )
}
