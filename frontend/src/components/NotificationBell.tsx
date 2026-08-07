import { useEffect, useRef, useState } from 'react'
import {
  useMarkAllNotificationsAsRead,
  useMarkNotificationAsRead,
  useNotifications,
} from '../features/notifications/useNotifications'
import { useNotificationSocket } from '../features/notifications/useNotificationSocket'
import type { AppNotification } from '../lib/types'

function describeNotification(notification: AppNotification): string {
  const data = notification.data as Record<string, unknown>
  switch (notification.type) {
    case 'task:assigned':
      return `Bạn được giao Task "${data.taskTitle ?? ''}"`
    case 'task:state-changed':
      return `Task "${data.taskTitle ?? ''}" chuyển sang "${data.toStateName ?? ''}"`
    case 'task:risk-alert':
      return `Task "${data.taskTitle ?? ''}" có nguy cơ trễ deadline (${data.riskScore ?? '?'}%)`
    default:
      return notification.type
  }
}

export function NotificationBell() {
  useNotificationSocket()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const { data } = useNotifications()
  const markAsRead = useMarkNotificationAsRead()
  const markAllAsRead = useMarkAllNotificationsAsRead()

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const unread = data?.unread ?? 0

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
        aria-label="Thông báo"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-5 w-5"
        >
          <path
            fillRule="evenodd"
            d="M5.25 9a6.75 6.75 0 0 1 13.5 0v.75c0 2.123.8 4.057 2.118 5.52a.75.75 0 0 1-.297 1.206c-1.544.57-3.16.99-4.831 1.243a3.75 3.75 0 1 1-7.48 0 24.585 24.585 0 0 1-4.831-1.244.75.75 0 0 1-.298-1.205A8.217 8.217 0 0 0 5.25 9.75V9Zm4.502 8.9a2.25 2.25 0 1 0 4.496 0 25.057 25.057 0 0 1-4.496 0Z"
            clipRule="evenodd"
          />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-md border border-gray-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
            <span className="text-sm font-medium text-gray-700">Thông báo</span>
            {unread > 0 && (
              <button
                onClick={() => markAllAsRead.mutate()}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
              >
                Đánh dấu tất cả đã đọc
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {!data || data.data.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-gray-400">
                Chưa có thông báo nào
              </p>
            ) : (
              data.data.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => {
                    if (!notification.isRead) markAsRead.mutate(notification.id)
                  }}
                  className={`block w-full border-b border-gray-50 px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                    notification.isRead ? 'text-gray-500' : 'font-medium text-gray-800'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!notification.isRead && (
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                    )}
                    <div>
                      <p>{describeNotification(notification)}</p>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {new Date(notification.createdAt).toLocaleString('vi-VN')}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
