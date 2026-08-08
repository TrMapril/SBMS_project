import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth.store'
import { NotificationBell } from './NotificationBell'
import { useMyTenantSlug } from '../features/tenants/useTenantConfig'
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
// Phase 7.5 Đợt 4 — Super Admin chỉ có 2 mục (Trang chủ + Quản lý doanh nghiệp), không thấy các
// mục nghiệp vụ trong-tenant (Workflow/Đơn từ/Hồ sơ...) vì bản thân không thuộc tenant nào
// (`tenantId = null`).
// Phase 7.5 Đợt 5 mục 6 — thêm "Workflow Template" cho Super Admin (bộ template dùng chung mọi
// tenant, khác "Workflow" của Admin từng tenant).
const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Trang chủ', roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE'] },
  { to: '/tenants', label: 'Quản lý doanh nghiệp', roles: ['SUPER_ADMIN'] },
  { to: '/workflow-templates', label: 'Workflow Template', roles: ['SUPER_ADMIN'] },
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

/** Phase 7.5 Đợt 5 mục 1 — icon cạnh chuông thông báo, mở tab mới tới trang giới thiệu công khai
 * của chính doanh nghiệp mình (`/t/:slug`). Mọi role trừ Super Admin (không thuộc tenant nào nên
 * không có trang công khai riêng) — xem `GET /tenants/me/slug` mới thêm ở backend. */
function PublicPageLink() {
  const { data } = useMyTenantSlug()
  if (!data) return null

  return (
    <a
      href={`/t/${data.slug}`}
      target="_blank"
      rel="noreferrer"
      title="Xem trang giới thiệu doanh nghiệp"
      className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        className="h-5 w-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
        />
      </svg>
    </a>
  )
}

export function AppLayout() {
  const { user, logout } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()
  if (!user) return null

  const items = NAV_ITEMS.filter((item) => item.roles.includes(user.systemRole))
  // Phase 7.5 Đợt 4 — nút Back ở mọi "trang con", tức mọi route KHÔNG phải 1 trong các trang gốc
  // theo sidebar của role hiện tại (đã lọc theo role ở `items`) — tự động đúng theo từng role mà
  // không cần liệt kê thủ công danh sách "trang con" (ví dụ /workflows/:id, /projects/:id/board,
  // /employees/:userId...), đúng tinh thần "không cần logic phức tạp" của phase_7_5.md.
  const isRootPage = items.some((item) => item.to === location.pathname)
  const showBackButton = !isRootPage

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
            {user.systemRole !== 'SUPER_ADMIN' && <PublicPageLink />}
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
          {showBackButton && (
            <button
              onClick={() => navigate(-1)}
              className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-800"
            >
              ← Quay lại
            </button>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  )
}
