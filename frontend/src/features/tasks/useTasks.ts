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
