import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getSocket } from '../../lib/socket'
import { NOTIFICATIONS_QUERY_KEY } from './useNotifications'

/**
 * Lắng nghe 3 event Socket.io Giai đoạn 6 (Mục "Quy ước Socket.io" plan.md) và invalidate đúng
 * React Query cache liên quan — đây là phần "phản ánh ngay không cần reload" của DoD, tách biệt
 * khỏi useNotifications (chỉ đọc lại từ DB, phục vụ trường hợp offline bị lỡ event).
 */
export function useNotificationSocket() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const invalidateNotifications = () => {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY })
    }
    const handleTaskEvent = () => {
      invalidateNotifications()
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    }
    const handleRiskAlert = () => {
      invalidateNotifications()
      void queryClient.invalidateQueries({ queryKey: ['algorithms', 'risk-alerts'] })
    }

    socket.on('task:assigned', handleTaskEvent)
    socket.on('task:state-changed', handleTaskEvent)
    socket.on('task:risk-alert', handleRiskAlert)

    return () => {
      socket.off('task:assigned', handleTaskEvent)
      socket.off('task:state-changed', handleTaskEvent)
      socket.off('task:risk-alert', handleRiskAlert)
    }
  }, [queryClient])
}
