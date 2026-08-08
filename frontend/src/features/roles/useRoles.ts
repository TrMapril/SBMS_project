import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../lib/api-client'
import type { PaginatedResponse, Role, RoleDetail } from '../../lib/types'

/** Admin-only: toàn bộ Custom Role trong tenant — dùng cho Workflow Builder chọn allow_roles. */
export function useRoles() {
  return useQuery({
    queryKey: ['roles'],
    queryFn: () => apiClient.get<PaginatedResponse<Role>>('/roles?limit=100'),
  })
}

/** Mở cho mọi thành viên tenant: Custom Role của chính user đang đăng nhập. */
export function useMyRoles() {
  return useQuery({
    queryKey: ['roles', 'me'],
    queryFn: () => apiClient.get<Role[]>('/roles/me'),
  })
}

/** Admin-only: Custom Role hiện tại của 1 Employee bất kỳ (trang User, tính năng "Đổi Custom
 * Role") — Phase 7.5 Đợt 2. */
export function useRolesForUser(userId: string | undefined) {
  return useQuery({
    queryKey: ['roles', 'by-user', userId],
    queryFn: () => apiClient.get<Role[]>(`/roles/by-user/${userId}`),
    enabled: !!userId,
  })
}

/** Admin-only: chi tiết 1 Custom Role kèm danh sách user đã được gán. */
export function useRole(id: string | undefined) {
  return useQuery({
    queryKey: ['roles', id],
    queryFn: () => apiClient.get<RoleDetail>(`/roles/${id}`),
    enabled: !!id,
  })
}

export function useRoleMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['roles'] })

  const createRole = useMutation({
    mutationFn: ({ name, description }: { name: string; description?: string }) =>
      apiClient.post<Role>('/roles', { name, description }),
    onSuccess: invalidate,
  })

  const updateRole = useMutation({
    mutationFn: ({
      id,
      name,
      description,
    }: {
      id: string
      name?: string
      description?: string
    }) => apiClient.patch<Role>(`/roles/${id}`, { name, description }),
    onSuccess: invalidate,
  })

  const removeRole = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/roles/${id}`),
    // Role vừa xoá không còn tồn tại — chỉ invalidate query danh sách (['roles'] chính xác), rồi
    // xoá hẳn cache chi tiết (['roles', id]) thay vì invalidate nó, tránh React Query refetch lại
    // 1 role vừa xoá (gây lỗi 404 hiện trên console dù UI vẫn đóng panel đúng).
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: ['roles'], exact: true })
      queryClient.removeQueries({ queryKey: ['roles', id] })
    },
  })

  const invalidateWithUser = (userId: string) => {
    invalidate()
    void queryClient.invalidateQueries({ queryKey: ['roles', 'by-user', userId] })
    void queryClient.invalidateQueries({ queryKey: ['users'] })
  }

  const assignUser = useMutation({
    mutationFn: ({ roleId, userId }: { roleId: string; userId: string }) =>
      apiClient.post(`/roles/${roleId}/users`, { userId }),
    onSuccess: (_data, { userId }) => invalidateWithUser(userId),
  })

  const unassignUser = useMutation({
    mutationFn: ({ roleId, userId }: { roleId: string; userId: string }) =>
      apiClient.delete(`/roles/${roleId}/users/${userId}`),
    onSuccess: (_data, { userId }) => invalidateWithUser(userId),
  })

  return { createRole, updateRole, removeRole, assignUser, unassignUser }
}
