import { useState, type ComponentProps, type ReactNode } from 'react'
import { Check, Eye, EyeOff } from 'lucide-react'
import { LogoMark } from '@/components/ui/Logo'
import { SmartImage } from '@/components/ui/SmartImage'
import { Input } from '@/components/ui/Field'
import { cn } from '@/lib/utils'
import { passwordChecks } from '@/schemas/auth'

const AUTH_IMAGE = 'https://images.unsplash.com/photo-1517502884422-41eaead166d4'

/** Split layout for authentication screens: form on the left, an editorial photo panel on large screens. */
export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="container-page grid min-h-[calc(100dvh-72px)] items-stretch gap-10 py-10 lg:grid-cols-2 lg:py-12">
      <div className="flex flex-col justify-center">
        <div className="mx-auto w-full max-w-md">
          <LogoMark className="size-11" />
          <h1 className="display mt-6 text-4xl sm:text-[2.75rem]">{title}</h1>
          {subtitle && <p className="mt-3 text-muted">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 border-t border-line pt-6 text-sm text-muted">{footer}</div>}
        </div>
      </div>
      <div className="relative hidden overflow-hidden rounded-[28px] lg:block">
        <SmartImage src={AUTH_IMAGE} alt="A bright, empty study room with a long table and chairs" width={1000} className="absolute inset-0 size-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-sage-900/80 via-sage-900/10 to-transparent" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 p-10 text-white">
          <p className="font-serif text-4xl leading-tight">Your group. Your space. Your goals.</p>
          <p className="mt-3 max-w-md text-sage-100/90">Reserve a private room for the whole group, see what’s free in real time, and keep every session in one place.</p>
        </div>
      </div>
    </div>
  )
}

export function PasswordInput(props: ComponentProps<'input'>) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input {...props} type={visible ? 'text' : 'password'} className={cn('pr-11', props.className)} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted hover:text-ink"
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
      >
        {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </div>
  )
}

export function PasswordChecklist({ value }: { value: string }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Password requirements">
      {passwordChecks(value).map((c) => (
        <li key={c.label} className={cn('inline-flex items-center gap-1', c.ok ? 'text-success' : 'text-muted')}>
          <Check className={cn('size-3.5', c.ok ? 'opacity-100' : 'opacity-30')} aria-hidden />
          {c.label}
          <span className="sr-only">{c.ok ? '(met)' : '(not yet met)'}</span>
        </li>
      ))}
    </ul>
  )
}
