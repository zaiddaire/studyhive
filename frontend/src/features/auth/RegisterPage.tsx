import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Field, FormError, Input } from '@/components/ui/Field'
import { ApiError, errorMessage } from '@/lib/api'
import { firstName } from '@/lib/utils'
import { registerSchema, type RegisterValues } from '@/schemas/auth'
import { safeRedirect } from '@/routes/guards'
import { authApi } from '@/services'
import { useAuth } from './AuthProvider'
import { AuthShell, PasswordChecklist, PasswordInput } from './AuthShell'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { signedIn } = useAuth()
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '' },
    mode: 'onTouched',
  })
  const mutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: (user) => {
      signedIn(user)
      toast.success(`Welcome to StudyHive, ${firstName(user.fullName)}!`)
      navigate(safeRedirect(params.get('redirect'), '/dashboard'), { replace: true })
    },
    onError: (error) => {
      // Server-side validation (e.g. email already registered) lands on the matching field.
      if (error instanceof ApiError) {
        for (const f of error.fieldErrors) {
          if (f.field in form.getValues()) form.setError(f.field as keyof RegisterValues, { message: f.message })
        }
      }
    },
  })
  const { errors } = form.formState
  const fieldErrorShown = mutation.error instanceof ApiError && mutation.error.fieldErrors.length > 0

  return (
    <AuthShell
      title="Create your account"
      subtitle="Free for students. Book rooms for your study group in minutes."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-sage-700 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form noValidate onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="flex flex-col gap-5">
        <FormError message={mutation.isError && !fieldErrorShown ? errorMessage(mutation.error) : null} />
        <Field label="Full name" required error={errors.fullName?.message}>
          {(a) => <Input {...a} autoComplete="name" autoFocus {...form.register('fullName')} />}
        </Field>
        <Field label="Email" required error={errors.email?.message}>
          {(a) => <Input {...a} type="email" autoComplete="email" inputMode="email" {...form.register('email')} />}
        </Field>
        <Field label="Password" required error={errors.password?.message}>
          {(a) => <PasswordInput {...a} autoComplete="new-password" {...form.register('password')} />}
        </Field>
        <PasswordChecklist value={form.watch('password')} />
        <Field label="Confirm password" required error={errors.confirmPassword?.message}>
          {(a) => <PasswordInput {...a} autoComplete="new-password" {...form.register('confirmPassword')} />}
        </Field>
        <Button type="submit" size="lg" loading={mutation.isPending}>
          Create account
        </Button>
        <p className="text-xs text-muted">
          By creating an account you agree to the <Link to="/terms" className="underline">terms of use</Link> and{' '}
          <Link to="/privacy" className="underline">privacy policy</Link>. We only store your name, email and bookings.
        </p>
      </form>
    </AuthShell>
  )
}
