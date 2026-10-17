import type { ComponentProps, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { LoaderCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent' | 'inverse'
type Size = 'sm' | 'md' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap select-none ' +
  'transition-[background-color,color,border-color,box-shadow,transform] duration-200 ease-out ' +
  'active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-700'

const variants: Record<Variant, string> = {
  primary: 'bg-sage-700 text-white shadow-soft hover:bg-sage-800 hover:shadow-lift',
  secondary: 'bg-card text-ink border border-line-strong hover:border-sage-500 hover:bg-sage-50',
  ghost: 'text-ink hover:bg-sage-100/70',
  danger: 'bg-danger text-white hover:bg-[#9a1d14] shadow-soft',
  accent: 'bg-champagne-400 text-ink hover:bg-[#b9996a] shadow-soft',
  inverse: 'bg-white text-sage-900 hover:bg-sage-50 shadow-soft',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm rounded-[9px]',
  md: 'h-11 px-5 text-[0.95rem] rounded-[10px]',
  lg: 'h-13 px-7 text-base rounded-[12px]',
}

export function buttonClasses(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cn(base, variants[variant], sizes[size], className)
}

interface ButtonProps extends ComponentProps<'button'> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
}

export function Button({ variant = 'primary', size = 'md', loading, icon, className, children, disabled, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  )
}

interface ButtonLinkProps extends LinkProps {
  variant?: Variant
  size?: Size
  icon?: ReactNode
}

export function ButtonLink({ variant = 'primary', size = 'md', icon, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonClasses(variant, size, typeof className === 'string' ? className : undefined)} {...rest}>
      {icon}
      {children}
    </Link>
  )
}
