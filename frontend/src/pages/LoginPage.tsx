import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useLogin } from '../features/auth/useAuth'
import { useAuthStore } from '../store/auth.store'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { ErrorBanner } from '../components/ui/ErrorBanner'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const login = useLogin()
  const navigate = useNavigate()
  const { accessToken } = useAuthStore()

  if (accessToken) {
    return <Navigate to="/" replace />
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    login.mutate(
      { email, password },
      { onSuccess: () => navigate('/', { replace: true }) },
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-gray-900">SBMS</h1>
        <p className="mb-6 text-sm text-gray-500">Đăng nhập vào hệ thống</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Email
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Mật khẩu
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {login.isError && <ErrorBanner error={login.error} />}

          <Button type="submit" className="w-full" disabled={login.isPending}>
            {login.isPending ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </Button>
        </form>
      </div>
    </div>
  )
}
