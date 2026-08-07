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
import { WorkflowsPage } from './pages/WorkflowsPage'
import { WorkflowBuilderPage } from './pages/WorkflowBuilderPage'
import { TaskBoardPage } from './pages/TaskBoardPage'
import { DashboardPage } from './pages/DashboardPage'
import { PublicTenantPage } from './pages/PublicTenantPage'
import { LeaveRequestsPage } from './pages/LeaveRequestsPage'
import { PersonnelPage } from './pages/PersonnelPage'
import { EmployeeProfilePage } from './pages/EmployeeProfilePage'
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
        <Route path="/" element={<HomePage />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute roles={['ADMIN', 'MANAGER']}>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/users"
          element={
            <ProtectedRoute roles={['ADMIN']}>
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
      </Route>
    </Routes>
  )
}

export default App
