import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../lib/api-client'
import type { PublicPostDetail, PublicPostSummary } from '../../lib/types'

/** Phase 7.5 Đợt 5 mục 4 — endpoint public, không cần JWT, dùng cho `/t/:slug` (danh sách) và
 * `/t/:slug/blog/:postSlug` (chi tiết). */
export function usePublicPosts(slug: string | undefined) {
  return useQuery({
    queryKey: ['public', 'tenant', slug, 'posts'],
    queryFn: () => apiClient.get<PublicPostSummary[]>(`/public/tenant/${slug}/posts`),
    enabled: !!slug,
    retry: false,
  })
}

export function usePublicPost(slug: string | undefined, postSlug: string | undefined) {
  return useQuery({
    queryKey: ['public', 'tenant', slug, 'posts', postSlug],
    queryFn: () => apiClient.get<PublicPostDetail>(`/public/tenant/${slug}/posts/${postSlug}`),
    enabled: !!slug && !!postSlug,
    retry: false,
  })
}
