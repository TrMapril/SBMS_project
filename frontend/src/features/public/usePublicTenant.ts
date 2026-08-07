import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../lib/api-client'
import type { PublicTenant } from '../../lib/types'

/** Endpoint public, không cần JWT — apiClient vẫn gắn Authorization nếu người dùng đã đăng nhập
 * sẵn ở tab khác, nhưng backend không đọc guard nào ở route này nên vô hại. */
export function usePublicTenant(slug: string | undefined) {
  return useQuery({
    queryKey: ['public', 'tenant', slug],
    queryFn: () => apiClient.get<PublicTenant>(`/public/tenant/${slug}`),
    enabled: !!slug,
    retry: false,
  })
}
