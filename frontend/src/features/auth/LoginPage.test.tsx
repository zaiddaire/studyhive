import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginPage from './LoginPage'
import RegisterPage from './RegisterPage'
import { mockApi, renderApp, student } from '@/test/utils'

const signedOut = { 'GET /api/auth/me': { status: 401, body: { code: 'UNAUTHENTICATED' } } }

describe('LoginPage', () => {
  it('validates fields before calling the API', async () => {
    const api = mockApi(signedOut)
    renderApp(<LoginPage />, { route: '/login' })
    await userEvent.click(await screen.findByRole('button', { name: 'Log in' }))
    expect(await screen.findByText('Email is required.')).toBeInTheDocument()
    expect(screen.getByText('Password is required.')).toBeInTheDocument()
    expect(api.calls.some((c) => c.path === '/api/auth/login')).toBe(false)
  })

  it('shows the generic server error for bad credentials', async () => {
    mockApi({
      ...signedOut,
      'POST /api/auth/login': { status: 401, body: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' } },
    })
    renderApp(<LoginPage />, { route: '/login' })
    await userEvent.type(await screen.findByLabelText(/^Email/), 'asha@example.test')
    await userEvent.type(screen.getByLabelText(/^Password/), 'wrong-pass1')
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.')
  })

  it('signs in and redirects to the requested page', async () => {
    const api = mockApi({ ...signedOut, 'POST /api/auth/login': { body: student } })
    renderApp(<LoginPage />, { route: '/login?redirect=%2Frooms%2F2', path: '/login' })
    await userEvent.type(await screen.findByLabelText(/^Email/), 'asha@example.test')
    await userEvent.type(screen.getByLabelText(/^Password/), 'Password123')
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))
    await waitFor(() => expect(screen.getByTestId('other-route')).toBeInTheDocument())
    const login = api.calls.find((c) => c.path === '/api/auth/login')!
    expect(login.body).toEqual({ email: 'asha@example.test', password: 'Password123' })
    expect(login.headers['X-XSRF-TOKEN']).toBe('test-csrf-token')
  })
})

describe('RegisterPage', () => {
  it('shows a server-side duplicate email error on the email field', async () => {
    mockApi({
      ...signedOut,
      'POST /api/auth/register': {
        status: 409,
        body: { code: 'EMAIL_TAKEN', message: 'An account with this email already exists.', fieldErrors: [{ field: 'email', message: 'An account with this email already exists.' }] },
      },
    })
    renderApp(<RegisterPage />, { route: '/signup' })
    await userEvent.type(await screen.findByLabelText(/^Full name/), 'Asha Learner')
    await userEvent.type(screen.getByLabelText(/^Email/), 'asha@example.test')
    await userEvent.type(screen.getByLabelText(/^Password\*?$/), 'Password123')
    await userEvent.type(screen.getByLabelText(/^Confirm password/), 'Password123')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByText('An account with this email already exists.')).toBeInTheDocument()
    expect(screen.getByLabelText(/^Email/)).toHaveAttribute('aria-invalid', 'true')
  })

  it('flags mismatched passwords', async () => {
    mockApi(signedOut)
    renderApp(<RegisterPage />, { route: '/signup' })
    await userEvent.type(await screen.findByLabelText(/^Full name/), 'Asha Learner')
    await userEvent.type(screen.getByLabelText(/^Email/), 'asha@example.test')
    await userEvent.type(screen.getByLabelText(/^Password\*?$/), 'Password123')
    await userEvent.type(screen.getByLabelText(/^Confirm password/), 'Password999')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument()
  })
})
