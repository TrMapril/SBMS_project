import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../lib/api-client'
import type { TenantConfig } from '../../lib/types'

export interface UpdateTenantConfigInput {
  systemName?: string
  primaryColor?: string
  logoUrl?: string
  enabledModules?: string[]
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
