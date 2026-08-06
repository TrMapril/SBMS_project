import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../lib/api-client'
import { toQuery } from '../../lib/query-string'
import type {
  AssignmentSuggestion,
  BottleneckSnapshot,
  RiskAlertTask,
} from '../../lib/types'

/** Thuật toán 1 — gợi ý phân công, dùng khi Manager chọn assignee lúc tạo Task. */
export function useAssignmentSuggestions(
  projectId: string | undefined,
  currentStateId?: string,
  enabled = true,
) {
  return useQuery({
    queryKey: ['algorithms', 'assignment-suggestions', projectId, currentStateId],
    queryFn: () =>
      apiClient.get<AssignmentSuggestion[]>(
        `/algorithms/assignment-suggestions?${toQuery({ projectId, currentStateId })}`,
      ),
    enabled: enabled && !!projectId,
  })
}

/** Thuật toán 2 — danh sách Task rủi ro trễ deadline, hiển thị ở Dashboard. */
export function useRiskAlerts(threshold?: number) {
  return useQuery({
    queryKey: ['algorithms', 'risk-alerts', threshold],
    queryFn: () =>
      apiClient.get<RiskAlertTask[]>(`/algorithms/risk-alerts?${toQuery({ threshold })}`),
  })
}

export function useRecomputeRiskScores() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient.post('/algorithms/risk-alerts/recompute'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['algorithms', 'risk-alerts'] })
    },
  })
}

/** Thuật toán 3 — snapshot bottleneck mới nhất của 1 Workflow, hiển thị heatmap ở Dashboard.
 * Khi chưa có snapshot nào, NestJS trả `null` bằng response rỗng (không có Content-Type) thay vì
 * literal JSON "null" — `apiClient` khi đó parse ra `undefined`. React Query bắt buộc queryFn trả
 * về giá trị xác định, nên ép `?? null` ở đây thay vì đổi hợp đồng chung của `apiClient`. */
export function useBottleneckSnapshot(workflowId: string | undefined) {
  return useQuery({
    queryKey: ['algorithms', 'bottleneck-snapshots', workflowId],
    queryFn: async () =>
      (await apiClient.get<BottleneckSnapshot | null>(
        `/algorithms/bottleneck-snapshots?${toQuery({ workflowId })}`,
      )) ?? null,
    enabled: !!workflowId,
  })
}

export function useRecomputeBottleneck(workflowId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiClient.post(
        `/algorithms/bottleneck-snapshots/recompute?${toQuery({ workflowId })}`,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['algorithms', 'bottleneck-snapshots', workflowId],
      })
    },
  })
}
