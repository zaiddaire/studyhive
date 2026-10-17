import { useState } from 'react'
import { assetUrl } from '@/lib/api'
import { cn } from '@/lib/utils'
import { LogoMark } from './Logo'

interface SmartImageProps {
  src?: string | null
  alt: string
  className?: string
  /** Width hint used to request a right-sized image from the Unsplash CDN. */
  width?: number
  priority?: boolean
}

function sized(url: string, width: number) {
  if (!url.includes('images.unsplash.com')) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}auto=format&fit=crop&q=70&w=${width}`
}

/**
 * Lazy-loaded image with a branded fallback: if the photo is missing or fails to load, an on-brand
 * honeycomb panel is shown instead of a broken image icon.
 */
export function SmartImage({ src, alt, className, width = 800, priority = false }: SmartImageProps) {
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const resolved = assetUrl(src)

  if (!resolved || failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={cn('honeycomb-bg flex items-center justify-center bg-gradient-to-br from-sage-100 to-champagne-100', className)}
      >
        <LogoMark className="size-12 opacity-70" />
      </div>
    )
  }
  const url = sized(resolved, width)
  return (
    <img
      src={url}
      srcSet={url.includes('images.unsplash.com') ? `${sized(resolved, Math.round(width / 2))} ${Math.round(width / 2)}w, ${url} ${width}w, ${sized(resolved, width * 2)} ${width * 2}w` : undefined}
      sizes={url.includes('images.unsplash.com') ? `(max-width: 640px) 100vw, ${width}px` : undefined}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      onError={() => setFailed(true)}
      onLoad={() => setLoaded(true)}
      className={cn('bg-sage-100 object-cover transition-opacity duration-500', loaded ? 'opacity-100' : 'opacity-0', className)}
    />
  )
}
