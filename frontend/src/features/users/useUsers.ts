import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../lib/api-client'
import { toQuery } from '../../lib/query-string'
import type { PaginatedResponse, SystemRole, User, UserStatus } from '../../lib/types'

export interface CreateUserInput {
  email: string
  fullName: string
  systemRole: 'ADMIN' | 'MANAGER' | 'EMPLOYEE'
}

export interface CreateUserResult {
  user: User
  tempPassword: string
}

export interface BulkCreateUserRow {
  fullName: string
  roleId?: string
}

export interface BulkCreateUsersResult {
  users: { email: string; fullName: string; tempPassword: string }[]
}

/** Phase 7.5 Đợt 2 — trang User đổi sang bảng có tìm kiếm + lọc theo trạng thái/vai trò. */
export function useUsers(
  params: { search?: string; status?: UserStatus; systemRole?: SystemRole } = {},
) {
  return useQuery({
    queryKey: ['users', params],
    queryFn: () =>
      apiClient.get<PaginatedResponse<User>>(
        `/users?${toQuery({
          search: params.search,
          status: params.status,
          systemRole: params.systemRole,
          limit: 100,
        })}`,
      ),
  })
}

export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateUserInput) =>
      apiClient.post<CreateUserResult>('/users', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

/** Phase 7.5 Đợt 2 — Admin thêm nhiều Employee cùng lúc, trả về mật khẩu tạm 1-lần cho từng dòng. */
export function useBulkCreateUsers() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (rows: BulkCreateUserRow[]) =>
      apiClient.post<BulkCreateUsersResult>('/users/bulk', { rows }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

export function useUpdateUserStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACTIVE' | 'LOCKED' }) =>
      apiClient.patch<User>(`/users/${id}/status`, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}
