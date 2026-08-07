import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth.store'

/** `/my-profile` chỉ là lối tắt tới đúng trang hồ sơ công khai của chính mình — tái dùng nguyên
 * `EmployeeProfilePage` (form sửa chỉ hiện khi xem đúng hồ sơ của bản thân), không tách logic
 * riêng cho "xem của mình" vs "xem của người khác". */
export function MyProfileRedirect() {
  const userId = useAuthStore((s) => s.user?.id)
  if (!userId) return null
  return <Navigate to={`/employees/${userId}`} replace />
}
