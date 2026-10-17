import { ButtonLink } from '@/components/ui/Button'
import { LogoMark } from '@/components/ui/Logo'

export default function NotFoundPage() {
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <LogoMark className="size-14" />
      <p className="eyebrow mt-8">Error 404</p>
      <h1 className="display mt-3 text-5xl">This room doesn’t exist</h1>
      <p className="mt-4 max-w-md text-muted">The page you were looking for has moved or never existed. Let’s get you back to the hive.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <ButtonLink to="/">Go home</ButtonLink>
        <ButtonLink to="/rooms" variant="secondary">
          Browse rooms
        </ButtonLink>
      </div>
    </div>
  )
}
