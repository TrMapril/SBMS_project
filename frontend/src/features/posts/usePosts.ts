import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../lib/api-client'
import type { TenantPost } from '../../lib/types'

const QUERY_KEY = ['posts'] as const

/** Phase 7.5 Đợt 5 mục 4 — Admin CRUD "Bài viết" cho landing page của tenant mình (Settings). */
export function usePosts() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => apiClient.get<TenantPost[]>('/posts'),
  })
}

export interface PostInput {
  title: string
  content: string
  published?: boolean
  coverImage?: File
}

function toFormData(input: PostInput): FormData {
  const formData = new FormData()
  formData.append('title', input.title)
  formData.append('content', input.content)
  if (input.published !== undefined) formData.append('published', String(input.published))
  if (input.coverImage) formData.append('coverImage', input.coverImage)
  return formData
}

export function useCreatePost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PostInput) => apiClient.postForm<TenantPost>('/posts', toFormData(input)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}

export function useUpdatePost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: PostInput & { id: string }) =>
      apiClient.patchForm<TenantPost>(`/posts/${id}`, toFormData(input)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}

export function useDeletePost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/posts/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}
