import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../lib/api-client'
import type { AssignmentWeights, TenantConfig } from '../../lib/types'

export interface UpdateTenantConfigInput {
  systemName?: string
  primaryColor?: string
  logoUrl?: string
  enabledModules?: string[]
  assignmentWeights?: AssignmentWeights
  introText?: string
  address?: string
  contactPhone?: string
  contactEmail?: string
  socialLinks?: Record<string, string>
}

export function useTenantConfig() {
  return useQuery({
    queryKey: ['tenant-config'],
    queryFn: () => apiClient.get<TenantConfig>('/tenants/me/config'),
  })
}

export function useUpdateTenantConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateTenantConfigInput) =>
      apiClient.patch<TenantConfig>('/tenants/me/config', input),
    onSuccess: (config) => {
      queryClient.setQueryData(['tenant-config'], config)
    },
  })
}

/** Giai đoạn 7 — bannerImages quản lý riêng khỏi PATCH chung (xem backend DECISIONS.md): mỗi lần
 * upload cần đếm giới hạn 5 ảnh ngay tại thời điểm đó. */
export function useAddBannerImage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      return apiClient.postForm<TenantConfig>('/tenants/me/config/banner-images', formData)
    },
    onSuccess: (config) => {
      queryClient.setQueryData(['tenant-config'], config)
    },
  })
}

export function useRemoveBannerImage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (index: number) =>
      apiClient.delete<TenantConfig>(`/tenants/me/config/banner-images/${index}`),
    onSuccess: (config) => {
      queryClient.setQueryData(['tenant-config'], config)
    },
  })
}
