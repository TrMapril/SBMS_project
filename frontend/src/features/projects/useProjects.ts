import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../lib/api-client'
import type { PaginatedResponse, Project, ProjectDetail } from '../../lib/types'

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
