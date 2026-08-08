import { NavLink, Outlet } from 'react-router-dom'
import { useAuthStore } from '../store/auth.store'
import { NotificationBell } from './NotificationBell'
import type { SystemRole } from '../lib/types'

interface NavItem {
  to: string
  label: string
  roles: SystemRole[]
}

// Phase 7.5 Đợt 2:
// - Gộp "Trang chủ" + "Dashboard" thành 1 mục (HomePage.tsx tự hiện thêm phần cảnh báo/bottleneck
//   nếu là Admin/Manager) — bỏ mục "Dashboard" riêng.
// - Thêm "Quản lý dự án" (read-only) cho Admin, tách khỏi "Dự án" của Manager/Employee.
// - Đổi "Nhân sự" -> "Đề xuất nhân sự" vì đã tách "Hồ sơ năng lực" ra khỏi trang này — Hồ sơ năng
//   lực của 1 Employee giờ CHỈ vào được qua nút "Xem chi tiết" ở trang Người dùng, không còn mục
//   sidebar riêng để browse tự do.
// Phase 7.5 Đợt 3 (bổ sung sau test tay) — Manager cũng thấy "Người dùng" (UsersPage.tsx tự ẩn
// nút tạo/khoá/đổi role khi không phải Admin, chỉ xem + "Xem chi tiết").
const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Trang chủ', roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
  { to: '/workflows', label: 'Workflow', roles: ['ADMIN'] },
  { to: '/users', label: 'Người dùng', roles: ['ADMIN', 'MANAGER'] },
  { to: '/roles', label: 'Custom Role', roles: ['ADMIN'] },
  { to: '/custom-fields', label: 'Custom Fields', roles: ['ADMIN'] },
  { to: '/admin/projects', label: 'Quản lý dự án', roles: ['ADMIN'] },
  { to: '/settings', label: 'Cài đặt', roles: ['ADMIN'] },
  { to: '/projects', label: 'Dự án', roles: ['MANAGER', 'EMPLOYEE'] },
  { to: '/leave-requests', label: 'Đơn từ', roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
  { to: '/personnel', label: 'Đề xuất nhân sự', roles: ['ADMIN', 'MANAGER'] },
  { to: '/my-profile', label: 'Hồ sơ của tôi', roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
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
          <div className="flex items-center gap-3">
            <NotificationBell />
            <button
              onClick={logout}
              className="text-sm font-medium text-gray-500 hover:text-gray-800"
            >
              Đăng xuất
            </button>
          </div>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
