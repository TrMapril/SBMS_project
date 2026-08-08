import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../lib/api-client'
import type { RequestTypeField, RequestTypeTemplate } from '../../lib/types'

const QUERY_KEY = ['request-types'] as const

/** Mở cho mọi thành viên tenant — Employee/Admin cần đọc để chọn loại đơn khi gửi đơn. */
export function useRequestTypes() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => apiClient.get<RequestTypeTemplate[]>('/request-types'),
  })
}

export function useRequestTypeMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY })

  const createRequestType = useMutation({
    mutationFn: (input: { name: string; fields: RequestTypeField[] }) =>
      apiClient.post<RequestTypeTemplate>('/request-types', input),
    onSuccess: invalidate,
  })

  const removeRequestType = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/request-types/${id}`),
    onSuccess: invalidate,
  })

  return { createRequestType, removeRequestType }
}
