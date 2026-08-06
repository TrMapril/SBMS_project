import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/auth.store'
import type { SystemRole } from '../lib/types'

export function ProtectedRoute({
  roles,
  children,
}: {
  roles?: SystemRole[]
  children: ReactNode
}) {
  const { accessToken, user } = useAuthStore()
  const location = useLocation()

  if (!accessToken || !user) {
    return <Navigate to="/login" replace />
  }

  if (user.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }

  if (roles && !roles.includes(user.systemRole)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
