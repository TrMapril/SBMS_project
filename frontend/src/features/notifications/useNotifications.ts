import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../lib/api-client'
import type { AppNotification, PaginatedResponse } from '../../lib/types'

type NotificationsResponse = PaginatedResponse<AppNotification> & { unread: number }

export const NOTIFICATIONS_QUERY_KEY = ['notifications'] as const

/** Danh sách notification của tôi — nguồn "đọc lại khi offline" (DoD Giai đoạn 6), khác với
 * luồng nhận realtime qua Socket.io (xem useNotificationSocket). */
export function useNotifications(limit = 20) {
  return useQuery({
    queryKey: [...NOTIFICATIONS_QUERY_KEY, limit],
    queryFn: () =>
      apiClient.get<NotificationsResponse>(`/notifications?limit=${limit}`),
    refetchInterval: 60_000,
  })
}

export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY })
    },
  })
}

export function useMarkAllNotificationsAsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient.patch('/notifications/read-all'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY })
    },
  })
}
