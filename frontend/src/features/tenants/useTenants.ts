import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../lib/api-client'
import type { PaginatedResponse, Tenant, TenantStatsOverview, User } from '../../lib/types'

export interface CreateTenantInput {
  name: string
  slug: string
}

export interface CreateTenantAdminInput {
  email: string
  fullName: string
}

export interface CreateTenantAdminResult {
  user: User
  tempPassword: string
}

/** Phase 7.5 Đợt 4 — "Trang quản lý doanh nghiệp" (Super Admin). */
export function useTenants() {
  return useQuery({
    queryKey: ['tenants'],
    queryFn: () => apiClient.get<PaginatedResponse<Tenant>>('/tenants?limit=100'),
  })
}

export function useTenantStatsOverview() {
  return useQuery({
    queryKey: ['tenants', 'stats-overview'],
    queryFn: () => apiClient.get<TenantStatsOverview>('/tenants/stats/overview'),
  })
}

export function useCreateTenant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateTenantInput) => apiClient.post<Tenant>('/tenants', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tenants'] })
    },
  })
}

/** Bootstrap Admin đầu tiên cho tenant vừa tạo — dùng lại API `POST /tenants/:id/admin` đã có từ
 * Giai đoạn 1, trả về mật khẩu tạm 1-lần giống cơ chế `POST /users`/`POST /users/bulk`. */
export function useCreateTenantAdmin() {
  return useMutation({
    mutationFn: ({ tenantId, ...input }: CreateTenantAdminInput & { tenantId: string }) =>
      apiClient.post<CreateTenantAdminResult>(`/tenants/${tenantId}/admin`, input),
  })
}

export function useUpdateTenantStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isDisabled }: { id: string; isDisabled: boolean }) =>
      apiClient.patch<Tenant>(`/tenants/${id}/status`, { isDisabled }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tenants'] })
    },
  })
}

export function useUpdateTenantMaxEmployees() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, maxEmployees }: { id: string; maxEmployees: number | null }) =>
      apiClient.patch<Tenant>(`/tenants/${id}/max-employees`, { maxEmployees }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tenants'] })
    },
  })
}
