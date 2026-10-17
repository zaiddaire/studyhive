import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Field, FormError, Input } from '@/components/ui/Field'
import { errorMessage } from '@/lib/api'
import { firstName } from '@/lib/utils'
import { loginSchema, type LoginValues } from '@/schemas/auth'
import { safeRedirect } from '@/routes/guards'
import { authApi } from '@/services'
import { useAuth } from './AuthProvider'
import { AuthShell, PasswordInput } from './AuthShell'

export default function LoginPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { signedIn } = useAuth()
  const form = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } })
  const mutation = useMutation({
    mutationFn: (v: LoginValues) => authApi.login(v.email, v.password),
    onSuccess: (user) => {
      signedIn(user)
      toast.success(`Welcome back, ${firstName(user.fullName)}.`)
      navigate(safeRedirect(params.get('redirect'), user.role === 'ADMIN' ? '/admin' : '/dashboard'), { replace: true })
    },
  })
  const { errors } = form.formState

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to book rooms and manage your group’s sessions."
      footer={
        <>
          New to StudyHive?{' '}
          <Link to={`/signup${params.get('redirect') ? `?redirect=${encodeURIComponent(params.get('redirect')!)}` : ''}`} className="font-semibold text-sage-700 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form noValidate onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="flex flex-col gap-5">
        <FormError message={mutation.isError ? errorMessage(mutation.error) : null} />
        <Field label="Email" required error={errors.email?.message}>
          {(a) => <Input {...a} type="email" autoComplete="email" inputMode="email" autoFocus {...form.register('email')} />}
        </Field>
        <Field label="Password" required error={errors.password?.message}>
          {(a) => <PasswordInput {...a} autoComplete="current-password" {...form.register('password')} />}
        </Field>
        <div className="-mt-2 flex justify-end">
          <Link to="/forgot-password" className="text-sm font-medium text-sage-700 hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" size="lg" loading={mutation.isPending}>
          Log in
        </Button>
      </form>
    </AuthShell>
  )
}
