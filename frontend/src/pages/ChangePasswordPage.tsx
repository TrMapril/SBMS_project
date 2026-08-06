import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useChangePassword } from '../features/auth/useAuth'
import { useAuthStore } from '../store/auth.store'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { ErrorBanner } from '../components/ui/ErrorBanner'

export function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const changePassword = useChangePassword()
  const navigate = useNavigate()
  const forced = useAuthStore((s) => s.user?.mustChangePassword)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    changePassword.mutate(
      { currentPassword, newPassword },
      { onSuccess: () => navigate('/', { replace: true }) },
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-gray-900">Đổi mật khẩu</h1>
        <p className="mb-6 text-sm text-gray-500">
          {forced
            ? 'Bạn cần đổi mật khẩu tạm trước khi tiếp tục sử dụng hệ thống.'
            : 'Cập nhật mật khẩu đăng nhập của bạn.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Mật khẩu hiện tại
            </label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Mật khẩu mới (tối thiểu 8 ký tự)
            </label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>

          {changePassword.isError && <ErrorBanner error={changePassword.error} />}

          <Button type="submit" className="w-full" disabled={changePassword.isPending}>
            {changePassword.isPending ? 'Đang lưu...' : 'Đổi mật khẩu'}
          </Button>
        </form>
      </div>
    </div>
  )
}
