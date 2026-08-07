import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../lib/api-client'
import { toQuery } from '../../lib/query-string'
import type { LeaveRequest, LeaveRequestStatus, PaginatedResponse } from '../../lib/types'

const QUERY_KEY = ['leave-requests'] as const

export function useLeaveRequests(status?: LeaveRequestStatus) {
  return useQuery({
    queryKey: [...QUERY_KEY, status],
    queryFn: () =>
      apiClient.get<PaginatedResponse<LeaveRequest>>(
        `/leave-requests?${toQuery({ status, limit: 100 })}`,
      ),
  })
}

export interface CreateLeaveRequestInput {
  startDate: string
  endDate: string
  reason: string
  file?: File
}

export function useCreateLeaveRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateLeaveRequestInput) => {
      const formData = new FormData()
      formData.append('startDate', input.startDate)
      formData.append('endDate', input.endDate)
      formData.append('reason', input.reason)
      if (input.file) formData.append('file', input.file)
      return apiClient.postForm<LeaveRequest>('/leave-requests', formData)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}

export function useResolveLeaveRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      status,
      comment,
    }: {
      id: string
      status: 'APPROVED' | 'REJECTED'
      comment?: string
    }) => apiClient.post<LeaveRequest>(`/leave-requests/${id}/resolve`, { status, comment }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}
