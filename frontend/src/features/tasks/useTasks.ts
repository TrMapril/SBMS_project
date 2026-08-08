import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../lib/api-client'
import { toQuery } from '../../lib/query-string'
import type { PaginatedResponse, Task, TaskDetail, TaskPriority } from '../../lib/types'

export function useTasks(projectId: string | undefined) {
  return useQuery({
    queryKey: ['tasks', { projectId }],
    queryFn: () =>
      apiClient.get<PaginatedResponse<Task>>(
        `/tasks?${toQuery({ projectId, limit: 100 })}`,
      ),
    enabled: !!projectId,
  })
}

export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: ['tasks', 'detail', id],
    queryFn: () => apiClient.get<TaskDetail>(`/tasks/${id}`),
    enabled: !!id,
  })
}

export interface CreateTaskInput {
  projectId: string
  title: string
  description?: string
  priority?: TaskPriority
  assigneeId?: string
  deadline?: string
  customFieldValues?: Record<string, unknown>
}

export function useCreateTask(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateTaskInput) => apiClient.post<Task>('/tasks', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks', { projectId }] })
    },
  })
}

export function useTransitionTask(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      taskId,
      transitionId,
      version,
      comment,
    }: {
      taskId: string
      transitionId: string
      version: number
      comment?: string
    }) =>
      apiClient.post<Task>(`/tasks/${taskId}/transition`, {
        transitionId,
        version,
        comment,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks', { projectId }] })
    },
  })
}

/** Phase 7.5 Đợt 1 mục B — assignee "Report Done" khi Task đang ở State is_end=true. */
export function useReportDone(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (taskId: string) => apiClient.post<Task>(`/tasks/${taskId}/report-done`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks', { projectId }] })
    },
  })
}

/** Manager "Xác nhận Done" — khoá Task vĩnh viễn. */
export function useConfirmDone(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (taskId: string) => apiClient.post<Task>(`/tasks/${taskId}/confirm-done`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks', { projectId }] })
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

/** Phase 7.5 Đợt 3 (bổ sung sau test tay) — Manager "Huỷ" Task: khoá vĩnh viễn như confirm-done
 * nhưng KHÔNG tính là hoàn thành, chỉ loại khỏi mẫu số % hoàn thành Project. */
export function useCancelTask(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (taskId: string) => apiClient.post<Task>(`/tasks/${taskId}/cancel`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks', { projectId }] })
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

/** Phase 7.5 Đợt 3 (bổ sung sau test tay) — Manager "Trả lại" khi Report Done chưa đạt: Task hoàn
 * về đúng State trước đó (KHÔNG khoá), khác "Trả task"/Reset (đưa hẳn về State bắt đầu). */
export function useRejectDone(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (taskId: string) => apiClient.post<Task>(`/tasks/${taskId}/reject-done`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks', { projectId }] })
    },
  })
}

/** Phase 7.5 Đợt 3 (bổ sung sau test tay) — Manager/Admin đổi assignee của Task đang active, chỉ
 * chọn được trong số `project_members` của project đó (kiểm tra ở BE). */
export function useUpdateTaskAssignee(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, assigneeId }: { taskId: string; assigneeId: string }) =>
      apiClient.patch<Task>(`/tasks/${taskId}/assignee`, { assigneeId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks', { projectId }] })
    },
  })
}

export function useAssignTaskCustomFields(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      taskId,
      values,
    }: {
      taskId: string
      values: Record<string, unknown>
    }) => apiClient.patch<Task>(`/tasks/${taskId}/custom-fields`, { values }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks', { projectId }] })
    },
  })
}
