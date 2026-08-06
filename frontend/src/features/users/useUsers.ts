import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../lib/api-client'
import { toQuery } from '../../lib/query-string'
import type { PaginatedResponse, User } from '../../lib/types'

export interface CreateUserInput {
  email: string
  fullName: string
  systemRole: 'ADMIN' | 'MANAGER' | 'EMPLOYEE'
}

export interface CreateUserResult {
  user: User
  tempPassword: string
}

export function useUsers(params: { page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['users', params],
    queryFn: () =>
      apiClient.get<PaginatedResponse<User>>(
        `/users?${toQuery({ page: params.page, limit: params.limit ?? 100 })}`,
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
