// src/app/pages/Login.test.tsx
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '../../test/server'
import { http, HttpResponse } from 'msw'
import { Login } from './Login'
import { renderWithProviders } from '../../test/renderWithProviders'

// helper to fill and submit the login form
async function submitLoginForm(email: string, password: string) {
  await userEvent.type(screen.getByLabelText(/email/i), email)
  await userEvent.type(screen.getByLabelText(/password/i), password)
  await userEvent.click(screen.getByRole('button', { name: /accedi/i }))
}

// --- success cases ---

test('admin user is redirected to /admin after login', async () => {
  server.use(
    http.post('/api/auth/token/', () => {
      return HttpResponse.json({
        access: 'fake-access-token',
        refresh: 'fake-refresh-token',
      })
    })
  )

  renderWithProviders(<Login />)
  await submitLoginForm('admin@danceschool.com', 'anypassword')

  // after redirect, the fake admin page should be visible
  expect(await screen.findByText('Admin Page')).toBeInTheDocument()
})

test('student user is redirected to /student after login', async () => {
  server.use(
    http.post('/api/auth/token/', () => {
      return HttpResponse.json({
        access: 'fake-access-token',
        refresh: 'fake-refresh-token',
      })
    })
  )

  renderWithProviders(<Login />)
  await submitLoginForm('student@example.com', 'anypassword')

  expect(await screen.findByText('Student Page')).toBeInTheDocument()
})

// --- error cases ---

test('shows error message when credentials are wrong', async () => {
  server.use(
    http.post('/api/auth/token/', () => {
      return HttpResponse.json(
        { detail: 'No active account found with the given credentials' },
        { status: 401 }
      )
    })
  )

  renderWithProviders(<Login />)
  await submitLoginForm('wrong@test.com', 'wrongpassword')

  expect(await screen.findByText(/invalid email or password/i)).toBeInTheDocument()
})

test('shows generic error message on server error', async () => {
  server.use(
    http.post('/api/auth/token/', () => {
      return HttpResponse.json(
        { detail: 'Internal server error' },
        { status: 500 }
      )
    })
  )

  renderWithProviders(<Login />)
  await submitLoginForm('test@test.com', 'anypassword')

  expect(await screen.findByText(/an error occurred/i)).toBeInTheDocument()
})
