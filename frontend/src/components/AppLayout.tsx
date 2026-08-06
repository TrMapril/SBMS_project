import { NavLink, Outlet } from 'react-router-dom'
import { useAuthStore } from '../store/auth.store'
import type { SystemRole } from '../lib/types'

interface NavItem {
  to: string
  label: string
  roles: SystemRole[]
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Trang chủ', roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
  { to: '/workflows', label: 'Workflow', roles: ['ADMIN'] },
  { to: '/users', label: 'Người dùng', roles: ['ADMIN'] },
  { to: '/roles', label: 'Custom Role', roles: ['ADMIN'] },
  { to: '/custom-fields', label: 'Custom Fields', roles: ['ADMIN'] },
  { to: '/settings', label: 'Cài đặt', roles: ['ADMIN'] },
  { to: '/projects', label: 'Dự án', roles: ['MANAGER', 'EMPLOYEE'] },
]

export function AppLayout() {
  const { user, logout } = useAuthStore()
  if (!user) return null

  const items = NAV_ITEMS.filter((item) => item.roles.includes(user.systemRole))

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="flex w-56 flex-col border-r border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-4">
          <span className="text-lg font-semibold text-gray-900">SBMS</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm font-medium ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
          <div className="text-sm text-gray-500">
            {user.fullName} <span className="text-gray-300">·</span>{' '}
            <span className="font-medium text-gray-700">{user.systemRole}</span>
          </div>
          <button
            onClick={logout}
            className="text-sm font-medium text-gray-500 hover:text-gray-800"
          >
            Đăng xuất
          </button>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
