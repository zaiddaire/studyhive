import {
  Accessibility,
  Armchair,
  Ear,
  Monitor,
  PenLine,
  PlugZap,
  Presentation,
  Sparkles,
  Sun,
  Table2,
  VolumeX,
  Wifi,
  Wind,
  type LucideIcon,
} from 'lucide-react'

const icons: Record<string, LucideIcon> = {
  'group-table': Table2,
  ergonomic: Armchair,
  whiteboard: Presentation,
  markers: PenLine,
  power: PlugZap,
  wifi: Wifi,
  ac: Wind,
  display: Monitor,
  quiet: VolumeX,
  'natural-light': Sun,
  'step-free': Accessibility,
  'hearing-loop': Ear,
}

export function AmenityIcon({ code, className = 'size-4' }: { code: string; className?: string }) {
  const Icon = icons[code] ?? Sparkles
  return <Icon className={className} aria-hidden />
}
