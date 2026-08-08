import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../lib/api-client'
import type { PaginatedResponse, Project, ProjectDetail, ProjectMember } from '../../lib/types'

export interface CreateProjectInput {
  name: string
  workflowId: string
}

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () =>
      apiClient.get<PaginatedResponse<Project>>('/projects?limit=100'),
  })
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: ['projects', id],
    queryFn: () => apiClient.get<ProjectDetail>(`/projects/${id}`),
    enabled: !!id,
  })
}

export function useCreateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateProjectInput) =>
      apiClient.post<Project>('/projects', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

/** Phase 7.5 Đợt 1 mục A — Manager huỷ/khởi động lại project. */
export function useCancelProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (projectId: string) => apiClient.post<Project>(`/projects/${projectId}/cancel`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

export function useRestartProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (projectId: string) => apiClient.post<Project>(`/projects/${projectId}/restart`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

export function useProjectMembers(projectId: string | undefined) {
  return useQuery({
    queryKey: ['projects', projectId, 'members'],
    queryFn: () => apiClient.get<ProjectMember[]>(`/projects/${projectId}/members`),
    enabled: !!projectId,
  })
}

export function useAddProjectMember(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) =>
      apiClient.post(`/projects/${projectId}/members`, { userId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projects', projectId] })
    },
  })
}

/** Phase 7.5 Đợt 3 — "Thêm nhân sự" cho phép tick chọn NHIỀU user cùng lúc rồi xác nhận 1 lần.
 * Dùng lại đúng API thêm-từng-user đã có (không thêm endpoint bulk mới ở backend), chỉ gọi song
 * song nhiều lần từ FE — đơn giản nhất, tránh mở rộng bề mặt API không cần thiết. */
export function useAddProjectMembers(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userIds: string[]) =>
      Promise.all(userIds.map((userId) => apiClient.post(`/projects/${projectId}/members`, { userId }))),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projects', projectId] })
    },
  })
}

export function useRemoveProjectMember(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) =>
      apiClient.delete(`/projects/${projectId}/members/${userId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projects', projectId] })
    },
  })
}

/** Phase 7.5 Đợt 1 mục C — Tạm dừng/Khôi phục 1 thành viên TRONG PHẠM VI project này, khác
 * `users.status` (Admin khoá toàn hệ thống). */
export function useSetProjectMemberStatus(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, action }: { userId: string; action: 'pause' | 'resume' }) =>
      apiClient.patch(`/projects/${projectId}/members/${userId}/${action}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projects', projectId] })
    },
  })
}
