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
  landingBackgroundColor?: string
  landingBackgroundImageUrl?: string
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

/** Phase 7.5 Đợt 5 mục 2 — logo/ảnh nền landing page đổi từ nhập URL thủ công sang upload ảnh
 * thật, cùng cơ chế Supabase Storage + giới hạn 5MB/magic bytes như bannerImages. */
export function useUploadLogo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      return apiClient.postForm<TenantConfig>('/tenants/me/config/logo', formData)
    },
    onSuccess: (config) => {
      queryClient.setQueryData(['tenant-config'], config)
    },
  })
}

export function useUploadBackgroundImage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      return apiClient.postForm<TenantConfig>('/tenants/me/config/background-image', formData)
    },
    onSuccess: (config) => {
      queryClient.setQueryData(['tenant-config'], config)
    },
  })
}

/** Xoá hẳn (khác PATCH {logoUrl:''}) — dọn luôn file khỏi Supabase Storage, không để mồ côi. */
export function useRemoveLogo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient.delete<TenantConfig>('/tenants/me/config/logo'),
    onSuccess: (config) => {
      queryClient.setQueryData(['tenant-config'], config)
    },
  })
}

export function useRemoveBackgroundImage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient.delete<TenantConfig>('/tenants/me/config/background-image'),
    onSuccess: (config) => {
      queryClient.setQueryData(['tenant-config'], config)
    },
  })
}

/** Phase 7.5 Đợt 5 mục 1 — MỌI role trong tenant (không riêng Admin) lấy slug của chính tenant
 * mình để dựng link "/t/:slug" (icon cạnh chuông thông báo, xem AppLayout.tsx). */
export function useMyTenantSlug() {
  return useQuery({
    queryKey: ['tenant-slug'],
    queryFn: () => apiClient.get<{ slug: string }>('/tenants/me/slug'),
  })
}
