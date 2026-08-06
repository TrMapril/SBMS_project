import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/auth.store'

const QUICK_LINKS: Record<string, { to: string; label: string }[]> = {
  ADMIN: [
    { to: '/workflows', label: 'Quản lý Workflow' },
    { to: '/users', label: 'Quản lý người dùng' },
    { to: '/custom-fields', label: 'Quản lý Custom Fields' },
  ],
  MANAGER: [{ to: '/projects', label: 'Quản lý dự án' }],
  EMPLOYEE: [{ to: '/projects', label: 'Xem dự án của tôi' }],
}

export function HomePage() {
  const user = useAuthStore((s) => s.user)
  if (!user) return null

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900">
        Chào {user.fullName}
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Vai trò hệ thống: <span className="font-medium">{user.systemRole}</span>
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(QUICK_LINKS[user.systemRole] ?? []).map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="rounded-lg border border-gray-200 bg-white p-4 text-sm font-medium text-gray-700 shadow-sm hover:border-indigo-300 hover:text-indigo-700"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
