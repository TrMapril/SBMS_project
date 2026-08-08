import { Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AppLayout } from './components/AppLayout'
import { LoginPage } from './pages/LoginPage'
import { ChangePasswordPage } from './pages/ChangePasswordPage'
import { HomePage } from './pages/HomePage'
import { UsersPage } from './pages/UsersPage'
import { RolesPage } from './pages/RolesPage'
import { CustomFieldsPage } from './pages/CustomFieldsPage'
import { SettingsPage } from './pages/SettingsPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { ProjectDetailPage } from './pages/ProjectDetailPage'
import { AdminProjectDetailPage, AdminProjectsPage } from './pages/AdminProjectsPage'
import { WorkflowsPage } from './pages/WorkflowsPage'
import { WorkflowBuilderPage } from './pages/WorkflowBuilderPage'
import { TaskBoardPage } from './pages/TaskBoardPage'
import { PublicTenantPage } from './pages/PublicTenantPage'
import { LeaveRequestsPage } from './pages/LeaveRequestsPage'
import { PersonnelPage } from './pages/PersonnelPage'
import { EmployeeProfilePage } from './pages/EmployeeProfilePage'
import { EmployeeCompetencyPage } from './pages/EmployeeCompetencyPage'
import { MyProfileRedirect } from './pages/MyProfileRedirect'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/t/:slug" element={<PublicTenantPage />} />
      <Route
        path="/change-password"
        element={
          <ProtectedRoute>
            <ChangePasswordPage />
          </ProtectedRoute>
        }
      />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        {/* Phase 7.5 Đợt 2 — gộp "Trang chủ" và "Dashboard" cũ thành 1 trang duy nhất, bỏ route
            /dashboard riêng (xem HomePage.tsx). */}
        <Route path="/" element={<HomePage />} />

        {/* Phase 7.5 Đợt 3 (bổ sung sau test tay) — Manager xem được (read-only, UsersPage.tsx tự
            ẩn nút tạo/khoá/đổi role khi không phải Admin). */}
        <Route
          path="/users"
          element={
            <ProtectedRoute roles={['ADMIN', 'MANAGER']}>
              <UsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/roles"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <RolesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/custom-fields"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <CustomFieldsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/workflows"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <WorkflowsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/workflows/:id"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <WorkflowBuilderPage />
            </ProtectedRoute>
          }
        />

        {/* Phase 7.5 Đợt 2 — trang Quản lý dự án CHỈ ĐỌC dành cho Admin, tách biệt khỏi /projects
            (Manager/Employee, có thao tác ghi) để không phải cài lại logic ẩn/hiện nút theo role
            trên cùng 1 trang. */}
        <Route
          path="/admin/projects"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <AdminProjectsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/projects/:id"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <AdminProjectDetailPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/projects"
          element={
            <ProtectedRoute roles={['MANAGER', 'EMPLOYEE']}>
              <ProjectsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/:id"
          element={
            <ProtectedRoute roles={['MANAGER', 'EMPLOYEE']}>
              <ProjectDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/:id/board"
          element={
            <ProtectedRoute roles={['MANAGER', 'EMPLOYEE']}>
              <TaskBoardPage />
            </ProtectedRoute>
          }
        />

        <Route path="/leave-requests" element={<LeaveRequestsPage />} />
        <Route
          path="/personnel"
          element={
            <ProtectedRoute roles={['ADMIN', 'MANAGER']}>
              <PersonnelPage />
            </ProtectedRoute>
          }
        />
        <Route path="/my-profile" element={<MyProfileRedirect />} />
        <Route path="/employees/:userId" element={<EmployeeProfilePage />} />
        {/* Phase 7.5 Đợt 2 — Hồ sơ năng lực NỘI BỘ, bỏ khỏi sidebar, chỉ vào được qua nút "Xem chi
            tiết" ở trang User (xem AppLayout.tsx NAV_ITEMS). */}
        <Route
          path="/employees/:userId/competency"
          element={
            <ProtectedRoute roles={['ADMIN', 'MANAGER']}>
              <EmployeeCompetencyPage />
            </ProtectedRoute>
          }
        />
      </Route>
    </Routes>
  )
}

export default App
