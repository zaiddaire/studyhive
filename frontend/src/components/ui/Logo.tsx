import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

/** The StudyHive mark: a honeycomb cell holding an open book, with a champagne "spark" for the group. */
export function LogoMark({ className, inverse = false }: { className?: string; inverse?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-8 shrink-0', className)} aria-hidden="true" focusable="false">
      <path
        d="M16 2.5 27.7 9.25v13.5L16 29.5 4.3 22.75V9.25Z"
        fill={inverse ? 'rgba(255,255,255,0.08)' : '#E7EDE4'}
        stroke={inverse ? '#E7EDE4' : '#435B47'}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path d="M8.6 12.6c2.6-1 5.1-.8 7.4.9v8.6c-2.3-1.6-4.8-1.9-7.4-.9Z" fill={inverse ? '#FFFFFF' : '#435B47'} />
      <path d="M23.4 12.6c-2.6-1-5.1-.8-7.4.9v8.6c2.3-1.6 4.8-1.9 7.4-.9Z" fill={inverse ? '#D3DDCF' : '#708A72'} />
      <circle cx="16" cy="8.4" r="1.7" fill="#C6A878" />
    </svg>
  )
}

export function Logo({ to = '/', inverse = false, className, label }: { to?: string; inverse?: boolean; className?: string; label?: string }) {
  return (
    <Link
      to={to}
      className={cn('group inline-flex items-center gap-2.5 rounded-md', className)}
      aria-label={label ?? 'StudyHive home'}
    >
      <LogoMark inverse={inverse} className="transition-transform duration-300 group-hover:rotate-[30deg]" />
      <span className={cn('font-serif text-[1.45rem] leading-none tracking-tight', inverse ? 'text-white' : 'text-ink')}>
        Study<span className={inverse ? 'text-champagne-400' : 'text-sage-700'}>Hive</span>
      </span>
    </Link>
  )
}
