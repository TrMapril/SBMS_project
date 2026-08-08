import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../lib/api-client'
import { toQuery } from '../../lib/query-string'
import type { LeaveRequest, LeaveRequestStatus, PaginatedResponse, RequestType } from '../../lib/types'

const QUERY_KEY = ['leave-requests'] as const

export function useLeaveRequests(status?: LeaveRequestStatus, type?: RequestType) {
  return useQuery({
    queryKey: [...QUERY_KEY, status, type],
    queryFn: () =>
      apiClient.get<PaginatedResponse<LeaveRequest>>(
        `/leave-requests?${toQuery({ status, type, limit: 100 })}`,
      ),
  })
}

export interface CreateLeaveRequestInput {
  type?: RequestType
  startDate?: string
  endDate?: string
  taskId?: string
  requestTypeId?: string
  customFieldValues?: Record<string, string>
  reason: string
  file?: File
}

export function useCreateLeaveRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateLeaveRequestInput) => {
      const formData = new FormData()
      if (input.type) formData.append('type', input.type)
      if (input.startDate) formData.append('startDate', input.startDate)
      if (input.endDate) formData.append('endDate', input.endDate)
      if (input.taskId) formData.append('taskId', input.taskId)
      if (input.requestTypeId) formData.append('requestTypeId', input.requestTypeId)
      if (input.customFieldValues) {
        formData.append('customFieldValues', JSON.stringify(input.customFieldValues))
      }
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

/** Phase 7.5 Đợt 1 mục D / Đợt 3 — Manager "Reset" 1 đơn TASK_RETURN đã resolve: Task về State
 * is_start, gỡ assignee. Chỉ áp dụng 1 lần cho mỗi đơn (chặn ở backend qua `taskResetAt`). */
export function useResetTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (leaveRequestId: string) =>
      apiClient.post(`/leave-requests/${leaveRequestId}/reset-task`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}
