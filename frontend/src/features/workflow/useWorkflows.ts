import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../lib/api-client'
import type {
  PaginatedResponse,
  TransitionCondition,
  Workflow,
  WorkflowDetail,
  WorkflowState,
  WorkflowTemplate,
} from '../../lib/types'

export function useWorkflows() {
  return useQuery({
    queryKey: ['workflows'],
    queryFn: () =>
      apiClient.get<PaginatedResponse<Workflow>>('/workflows?limit=100'),
  })
}

export function useWorkflow(id: string | undefined) {
  return useQuery({
    queryKey: ['workflows', id],
    queryFn: () => apiClient.get<WorkflowDetail>(`/workflows/${id}`),
    enabled: !!id,
  })
}

export function useCreateWorkflow() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (name: string) =>
      apiClient.post<Workflow>('/workflows', { name }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workflows'] })
    },
  })
}

/** Danh sách Workflow Template dùng chung toàn hệ thống (không thuộc riêng tenant nào). */
export function useWorkflowTemplates() {
  return useQuery({
    queryKey: ['workflow-templates'],
    queryFn: () => apiClient.get<WorkflowTemplate[]>('/workflow-templates'),
  })
}

/** Import = clone dữ liệu (Mục 3.10 CLAUDE.md) — tạo Workflow mới thuộc tenant hiện tại. */
export function useImportWorkflowTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ templateId, name }: { templateId: string; name?: string }) =>
      apiClient.post<Workflow>(`/workflow-templates/${templateId}/import`, { name }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workflows'] })
    },
  })
}

interface CreateStateInput {
  name: string
  isStart?: boolean
  isEnd?: boolean
  orderIndex?: number
  positionX?: number
  positionY?: number
}

interface UpdateStateInput extends Partial<CreateStateInput> {
  isActive?: boolean
}

interface CreateTransitionInput {
  name: string
  fromStateId: string
  toStateId: string
  allowRoles?: string[]
  condition?: TransitionCondition
}

interface UpdateTransitionInput extends Partial<CreateTransitionInput> {
  isActive?: boolean
}

/** Các thao tác chỉnh sửa 1 Workflow cụ thể — gom chung vì Workflow Builder luôn thao tác trên
 * toàn bộ đồ thị (states + transitions) của đúng 1 workflowId tại 1 thời điểm. */
export function useWorkflowMutations(workflowId: string) {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['workflows', workflowId] })

  const createState = useMutation({
    mutationFn: (input: CreateStateInput) =>
      apiClient.post<WorkflowState>(`/workflows/${workflowId}/states`, input),
    onSuccess: invalidate,
  })

  const updateState = useMutation({
    mutationFn: ({ stateId, ...input }: { stateId: string } & UpdateStateInput) =>
      apiClient.patch(`/workflows/${workflowId}/states/${stateId}`, input),
    onSuccess: invalidate,
  })

  const removeState = useMutation({
    mutationFn: (stateId: string) =>
      apiClient.delete(`/workflows/${workflowId}/states/${stateId}`),
    onSuccess: invalidate,
  })

  const createTransition = useMutation({
    mutationFn: (input: CreateTransitionInput) =>
      apiClient.post(`/workflows/${workflowId}/transitions`, input),
    onSuccess: invalidate,
  })

  const updateTransition = useMutation({
    mutationFn: ({
      transitionId,
      ...input
    }: { transitionId: string } & UpdateTransitionInput) =>
      apiClient.patch(
        `/workflows/${workflowId}/transitions/${transitionId}`,
        input,
      ),
    onSuccess: invalidate,
  })

  const removeTransition = useMutation({
    mutationFn: (transitionId: string) =>
      apiClient.delete(`/workflows/${workflowId}/transitions/${transitionId}`),
    onSuccess: invalidate,
  })

  return {
    createState,
    updateState,
    removeState,
    createTransition,
    updateTransition,
    removeTransition,
  }
}
